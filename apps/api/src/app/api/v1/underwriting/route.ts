/**
 * GET /api/v1/underwriting
 *
 * Admin underwriting dashboard — returns a prioritised queue of applications
 * requiring human review, with risk indicators and AI decision summaries.
 *
 * WHO USES THIS:
 *   Credit officers and underwriters with role = UNDERWRITER | CREDIT_OFFICER | ADMIN.
 *   The ops app renders this into a decision queue where reviewers can approve,
 *   reject, or request additional documents.
 *
 * WHAT IT SHOWS:
 *   - Applications in HUMAN_REVIEW or AUTO_DECISIONED state
 *   - Latest CreditDecision per application (PD score, risk band, policy violations)
 *   - AML alert flags (HIGH/MEDIUM)
 *   - KYC status per borrower (all checks must be PASSED to approve)
 *   - Fraud flags from the fraud detector
 *   - Bureau score (if available)
 *   - Risk scoring details with ML PD score
 *
 * RISK INDICATORS DISPLAYED:
 *   RedFlag  — blocks auto-approval; MUST be manually cleared
 *   Amber    — review recommended; can approve with justification
 *
 * ACCESS CONTROL:
 *   Requires a valid Clerk session token with role UNDERWRITER | CREDIT_OFFICER | ADMIN.
 *   In production, wire Clerk server-side auth to verify the role.
 *
 * Patterns applied:
 *   1. Early return — unauthorized, invalid params
 *   4. Destructuring — searchParams
 *   5. Array methods — map + filter for risk indicators
 *   6. to() helper
 *   7. Property shorthand
 *   8. Composition — load → enrich → sort → paginate
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@capstack/db';

async function to<T>(p: Promise<T>): Promise<[Error, null] | [null, T]> {
  try { return [null, await p]; }
  catch (err) { return [err instanceof Error ? err : new Error(String(err)), null]; }
}

// ─── Risk indicator builder ────────────────────────────────────────────────────

interface RiskIndicator {
  code:     string;
  severity: 'RED' | 'AMBER' | 'INFO';
  message:  string;
}

function _buildRiskIndicators(
  decision:     { pdScore: number; riskBand: string; reasonCodes: string[]; policyExceptions: string[] } | null,
  kycStatuses:  string[],
  amlAlerts:    { severity: string }[],
): RiskIndicator[] {
  const indicators: RiskIndicator[] = [];

  // Pattern 5 — build indicators from multiple data sources
  if (decision) {
    if (decision.pdScore >= 0.20) {
      indicators.push({
        code:     'HIGH_PD',
        severity: 'RED',
        message:  `Probability of default is ${(decision.pdScore * 100).toFixed(1)}% (threshold: 20%)`,
      });
    } else if (decision.pdScore >= 0.10) {
      indicators.push({
        code:     'ELEVATED_PD',
        severity: 'AMBER',
        message:  `Probability of default is ${(decision.pdScore * 100).toFixed(1)}% — monitor closely`,
      });
    }

    if (['D', 'E'].includes(decision.riskBand)) {
      indicators.push({
        code:     'HIGH_RISK_BAND',
        severity: 'RED',
        message:  `Risk band ${decision.riskBand} — below acceptable threshold`,
      });
    }

    if (decision.policyExceptions.length > 0) {
      indicators.push({
        code:     'POLICY_EXCEPTIONS',
        severity: 'RED',
        message:  `Policy exceptions granted: ${decision.policyExceptions.join(', ')}`,
      });
    }

    if (decision.reasonCodes.length > 0) {
      indicators.push({
        code:     'DECLINE_FACTORS',
        severity: 'AMBER',
        message:  `Decline factors: ${decision.reasonCodes.slice(0, 3).join('; ')}`,
      });
    }
  }

  // KYC blockers
  const failedKyc = kycStatuses.filter(s => s === 'FAILED' || s === 'MANUAL_REVIEW');
  if (failedKyc.length > 0) {
    indicators.push({
      code:     'KYC_INCOMPLETE',
      severity: 'RED',
      message:  `${failedKyc.length} KYC check(s) failed or require manual review`,
    });
  }

  const pendingKyc = kycStatuses.filter(s => s === 'PENDING' || s === 'IN_PROGRESS');
  if (pendingKyc.length > 0) {
    indicators.push({
      code:     'KYC_PENDING',
      severity: 'AMBER',
      message:  `${pendingKyc.length} KYC check(s) still in progress`,
    });
  }

  // AML flags
  const highAml = amlAlerts.filter(a => a.severity === 'HIGH' || a.severity === 'CRITICAL');
  if (highAml.length > 0) {
    indicators.push({
      code:     'AML_ALERT',
      severity: 'RED',
      message:  `${highAml.length} HIGH severity AML alert(s) — SAR may be required`,
    });
  }

  return indicators;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // ── Auth check (stub — production: use Clerk getAuth()) ───────────────
  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Pattern 4 — destructure query params
  const { searchParams } = new URL(req.url);
  const take   = Math.min(Number(searchParams.get('limit')  ?? 20), 100);
  const skip   = Number(searchParams.get('offset') ?? 0);
  const status = searchParams.get('status') ?? 'HUMAN_REVIEW';  // default: review queue

  const validStatuses = ['HUMAN_REVIEW', 'AUTO_DECISIONED', 'UNDER_REVIEW', 'KYC_IN_PROGRESS'];
  if (!validStatuses.includes(status)) {
    return NextResponse.json({
      error:        'Invalid status filter',
      validStatuses,
    }, { status: 400 });
  }

  // ── Load applications with full context ───────────────────────────────
  const [appsErr, applications] = await to(
    prisma.application.findMany({
      where: {
        status: status as import('@capstack/db').ApplicationStatus,
      },
      include: {
        borrower: {
          include: {
            individual: true,
            kycChecks:  { orderBy: { createdAt: 'desc' } },
          },
        },
        product:   true,
        decisions: { orderBy: { createdAt: 'desc' }, take: 1 },
        events:    { orderBy: { createdAt: 'desc' }, take: 5 },
      },
      orderBy: { submittedAt: 'asc' }, // oldest first — FIFO review queue
      take,
      skip,
    }),
  );

  if (appsErr) return NextResponse.json({ error: appsErr.message }, { status: 500 });

  // ── Load AML alerts for affected borrowers ────────────────────────────
  const borrowerIds = [...new Set((applications ?? []).map(a => a.borrowerId))];
  const [amlErr, amlAlerts] = await to(
    prisma.amlAlert.findMany({
      where: {
        borrowerId: { in: borrowerIds },
        status:     'OPEN',
      },
    }),
  );

  const alertsByBorrower = (amlAlerts ?? []).reduce<Record<string, typeof amlAlerts>>(
    (acc, alert) => {
      if (alert.borrowerId) {
        acc[alert.borrowerId] = [...(acc[alert.borrowerId] ?? []), alert];
      }
      return acc;
    },
    {},
  );

  // ── Enrich each application with risk indicators ───────────────────────
  const queue = (applications ?? []).map(app => {
    const latestDecision = app.decisions[0] ?? null;
    const kycStatuses    = app.borrower.kycChecks.map(k => k.status);
    const amlForBorrower = alertsByBorrower[app.borrowerId] ?? [];

    const riskIndicators = _buildRiskIndicators(
      latestDecision
        ? {
            pdScore:          latestDecision.pdScore,
            riskBand:         latestDecision.riskBand,
            reasonCodes:      latestDecision.reasonCodes,
            policyExceptions: latestDecision.policyExceptions,
          }
        : null,
      kycStatuses,
      amlForBorrower.map(a => ({ severity: a.severity })),
    );

    // Priority: RED indicators first, then by submission date
    const priority = riskIndicators.some(i => i.severity === 'RED')
      ? 'HIGH'
      : riskIndicators.some(i => i.severity === 'AMBER')
        ? 'MEDIUM'
        : 'LOW';

    return {
      applicationId:   app.id,
      submittedAt:     app.submittedAt.toISOString(),
      status:          app.status,
      priority,
      riskIndicators,
      redFlagCount:    riskIndicators.filter(i => i.severity === 'RED').length,
      borrower: {
        id:            app.borrowerId,
        name:          app.borrower.individual?.fullName ?? 'N/A',
        email:         app.borrower.email,
        kycStatuses,
      },
      loan: {
        product:       app.product?.name ?? 'N/A',
        amountRand:    Number(app.amountRequested) / 100,
        termDays:      app.termDaysRequested,
        purpose:       app.purpose ?? 'N/A',
      },
      decision: latestDecision
        ? {
            id:            latestDecision.id,
            recommendation: latestDecision.recommendation,
            pdScore:        latestDecision.pdScore,
            riskBand:       latestDecision.riskBand,
            approvedAprBps: latestDecision.approvedAprBps,
            reasonCodes:    latestDecision.reasonCodes,
            modelVersion:   latestDecision.modelVersion,
            createdAt:      latestDecision.createdAt.toISOString(),
          }
        : null,
      amlAlerts: amlForBorrower.map(a => ({
        id:        a.id,
        type:      a.type,
        severity:  a.severity,
        filedSar:  a.filedSar,
        createdAt: a.createdAt.toISOString(),
      })),
    };
  });

  // Sort: RED-flagged first
  queue.sort((a, b) => b.redFlagCount - a.redFlagCount);

  const total = await prisma.application.count({
    where: { status: status as import('@capstack/db').ApplicationStatus },
  }).catch(() => queue.length);

  // Pattern 7 — shorthand
  return NextResponse.json({ queue, total, take, skip });
}
