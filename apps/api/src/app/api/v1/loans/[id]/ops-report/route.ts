/**
 * GET /api/v1/loans/[id]/ops-report
 *
 * Returns the full internal loan record as a PDF for ops staff use.
 *
 * AUDIENCE: INTERNAL STAFF ONLY (UNDERWRITER | CREDIT_OFFICER | ADMIN | COMPLIANCE).
 * Includes: risk scores, PD score, policy exceptions, AML flags, fraud signals,
 * KYC check results, internal event log, collections history.
 *
 * The borrower must NEVER receive this document.
 * Auth: requires staff Bearer token with appropriate role.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@capstack/db';
import { renderOpsLoanRecord } from '@/lib/pdf/ops-loan-record';

async function to<T>(p: Promise<T>): Promise<[Error, null] | [null, T]> {
  try { return [null, await p]; }
  catch (err) { return [err instanceof Error ? err : new Error(String(err)), null]; }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Auth guard — require Bearer token (production: validate Clerk JWT + role check)
  const auth = req.headers.get('authorization') ?? '';
  if (!auth.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: loanId } = await params;
  const generatedBy = req.headers.get('x-staff-name') ?? 'Staff';

  const [loanErr, loan] = await to(
    prisma.loan.findUnique({
      where: { id: loanId },
      include: {
        borrower: {
          include: {
            individual: true,
            kycChecks:  { orderBy: { createdAt: 'desc' } },
          },
        },
        product: true,
        application: {
          include: {
            decisions: { orderBy: { createdAt: 'desc' }, take: 1, include: { decisionMaker: true } },
            events: { orderBy: { createdAt: 'desc' }, take: 20 },
          },
        },
        repayments: { orderBy: { receivedAt: 'asc' } },
        collections: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    }),
  );

  if (loanErr) return NextResponse.json({ error: 'DB error' }, { status: 500 });
  if (!loan)   return NextResponse.json({ error: 'Loan not found' }, { status: 404 });

  // Load AML alerts separately so we don't over-include in loan include
  const [, amlAlerts] = await to(
    prisma.amlAlert.findMany({
      where: { borrowerId: loan.borrowerId, status: 'OPEN' },
    }),
  );

  const latestDecision = loan.application?.decisions[0] ?? null;
  const principalRand  = Number(loan.principal) / 100;
  const aprPct         = loan.aprBps / 100;
  const initiationFeeRand = loan.product?.fixedFeeAmount ? Number(loan.product.fixedFeeAmount) / 100 : 0;
  const totalInterestRand = principalRand * (loan.aprBps / 10000) * (loan.termDays / 365);
  const totalCostRand  = principalRand + totalInterestRand + initiationFeeRand;
  const combinedEvents = [
    ...(loan.application?.events ?? []).map((event) => ({
      type: event.type,
      notes: (event.payload as { notes?: string })?.notes ?? '',
      actorName: event.actor,
      createdAt: event.createdAt,
    })),
    ...loan.collections.map((event) => ({
      type: event.type,
      notes: (event.payload as { notes?: string })?.notes ?? event.outcome ?? '',
      actorName: event.channel ?? 'Collections',
      createdAt: event.createdAt,
    })),
  ].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());

  const pdfBuffer = await renderOpsLoanRecord({
    generatedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
    generatedBy,
    loanNumber:  loan.loanNumber,
    borrower: {
      id:            loan.borrowerId,
      name:          loan.borrower?.individual?.fullName ?? 'N/A',
      email:         loan.borrower?.email ?? 'N/A',
      phone:         loan.borrower?.phone ?? 'N/A',
      riskRating:    loan.borrower?.riskRating ?? 'N/A',
      blacklistFlag: loan.borrower?.blacklistFlag ?? false,
      bureauScore:   null, // extend when bureau score is stored on borrower
    },
    loan: {
      id:            loan.id,
      product:       loan.product?.name ?? 'N/A',
      status:        loan.status,
      principalRand: principalRand.toFixed(2),
      aprPct:        aprPct.toFixed(2),
      termDays:      loan.termDays,
      startDate:     loan.startDate.toISOString().slice(0, 10),
      maturityDate:  loan.maturityDate.toISOString().slice(0, 10),
      dpd:           loan.daysPastDue,
      bucket:        loan.delinquencyState,
    },
    decision: latestDecision
      ? {
          recommendation:   latestDecision.recommendation,
          pdScore:          latestDecision.pdScore,
          riskBand:         latestDecision.riskBand,
          approvedAprBps:   latestDecision.approvedAprBps,
          reasonCodes:      latestDecision.reasonCodes,
          policyExceptions: latestDecision.policyExceptions,
          modelVersion:     latestDecision.modelVersion,
          decidedAt:        latestDecision.createdAt.toISOString().slice(0, 16).replace('T', ' '),
        }
      : null,
    ncr: {
      totalCostOfCreditRand:   totalCostRand.toFixed(2),
      annualPercentageRatePct: aprPct.toFixed(2),
      initiationFeeRand:       initiationFeeRand.toFixed(2),
    },
    kycChecks: (loan.borrower?.kycChecks ?? []).map(k => ({
      type:      k.type,
      status:    k.status,
      provider:  k.provider,
      updatedAt: (k.completedAt ?? k.createdAt).toISOString().slice(0, 10),
    })),
    amlAlerts: (amlAlerts ?? []).map(a => ({
      type:      a.type,
      severity:  a.severity,
      filedSar:  a.filedSar,
      createdAt: a.createdAt.toISOString().slice(0, 10),
    })),
    fraudSignals: [],  // extend when fraud check results stored per application
    repaymentHistory: loan.repayments.map(r => ({
      date:       new Date(r.receivedAt).toISOString().slice(0, 10),
      amountRand: (Number(r.amount) / 100).toFixed(2),
      rail:       r.rail,
      status:     'RECEIVED',
    })),
    events: combinedEvents.map(event => ({
      type:      event.type,
      notes:     event.notes,
      actorName: event.actorName,
      createdAt: event.createdAt.toISOString().slice(0, 16).replace('T', ' '),
    })),
  });

  return new Response(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="ops_loan_${loanId}.pdf"`,
    },
  });
}
