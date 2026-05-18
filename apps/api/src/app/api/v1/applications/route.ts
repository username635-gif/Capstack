/**
 * POST /api/v1/applications
 *
 * Creates a new loan application for a borrower.
 */

import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { inngest } from '@/lib/inngest';
import { authorizeOpsRequest } from '@/lib/ops-auth';
import {
  REVIEW_QUEUE_STATUSES,
  buildAffordabilitySummary,
  buildAiSummary,
  buildBureauSummary,
  deriveWorkflowStatus,
  extractLatestFlag,
  extractLatestAssignment,
  extractNotes,
  getAgeHours,
  getApprovalTier,
  getSlaStatus,
  summarizeAmlRisk,
  summarizeKycStatus,
  type WorkflowStatus,
} from '@/lib/application-review';

const DEMO_MODE = !process.env.DATABASE_URL;
const IDEMPOTENCY_TTL = 60 * 60 * 24;
const APPLICATION_READ_ROLES = ['ADMIN', 'UNDERWRITER', 'CREDIT_OFFICER', 'COMPLIANCE', 'FINANCE', 'READONLY'];

type ApplicationBody = {
  borrowerId: string;
  productId: string;
  amountRequested: number;
  termDaysRequested: number;
  purpose?: string;
  channel?: string;
  externalRef?: string;
};

async function to<T>(p: Promise<T>): Promise<[Error, null] | [null, T]> {
  try {
    return [null, await p];
  } catch (err) {
    return [err instanceof Error ? err : new Error(String(err)), null];
  }
}

function buildWorkflowWhere(workflowStatus: WorkflowStatus, baseWhere: Record<string, unknown>) {
  switch (workflowStatus) {
    case 'ALL':
      return baseWhere;
    case 'SUBMITTED':
      return { ...baseWhere, status: { in: REVIEW_QUEUE_STATUSES } };
    case 'APPROVED':
      return {
        ...baseWhere,
        status: 'APPROVED',
        NOT: { loan: { is: { status: 'PENDING_DISBURSEMENT' } } },
      };
    case 'REJECTED':
      return { ...baseWhere, status: 'REJECTED' };
    case 'PENDING_DISBURSEMENT':
      return { ...baseWhere, loan: { is: { status: 'PENDING_DISBURSEMENT' } } };
    default:
      return baseWhere;
  }
}

export async function POST(req: NextRequest) {
  const idempotencyKey = req.headers.get('idempotency-key');

  if (idempotencyKey) {
    const cached = await redis.get(`idempotency:${idempotencyKey}`);
    if (cached) {
      return NextResponse.json(cached, {
        status: 200,
        headers: { 'X-Idempotent': 'true' },
      });
    }
  }

  const [parseErr, body] = await to(req.json() as Promise<ApplicationBody>);
  if (parseErr) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

  const {
    borrowerId,
    productId,
    amountRequested: requestedAmount,
    termDaysRequested,
    purpose = null,
    channel = 'partner_api',
    externalRef = null,
  } = body!;

  if (!borrowerId || !productId || !requestedAmount || !termDaysRequested) {
    return NextResponse.json(
      { error: 'Missing required fields: borrowerId, productId, amountRequested, termDaysRequested' },
      { status: 422 },
    );
  }

  if (DEMO_MODE) {
    const now = new Date().toISOString();
    const demoAprBps = 1800;
    const demoTermYears = termDaysRequested / 365;
    const demoInterestRand = (requestedAmount / 100) * (demoAprBps / 10000) * demoTermYears;
    const demoApp = {
      id: `demo_app_${Math.random().toString(36).slice(2, 10)}`,
      borrowerId,
      productId,
      amountRequested: requestedAmount,
      termDaysRequested,
      purpose,
      channel,
      externalRef,
      status: 'SUBMITTED',
      submittedAt: now,
      createdAt: now,
      updatedAt: now,
      ncrDisclosure: {
        annualPercentageRatePct: demoAprBps / 100,
        initiationFeeRand: 0,
        estimatedTotalInterestRand: Number(demoInterestRand.toFixed(2)),
        totalCostOfCreditRand: Number(((requestedAmount / 100) + demoInterestRand).toFixed(2)),
        disclaimer: 'Estimate only. Final figures confirmed at approval per NCA s.92.',
      },
    };

    if (idempotencyKey) {
      await redis.set(`idempotency:${idempotencyKey}`, demoApp, { ex: IDEMPOTENCY_TTL }).catch(() => {});
    }

    return NextResponse.json(demoApp, { status: 201 });
  }

  const { prisma } = await import('@capstack/db');
  const [dbErr, application] = await to(
    prisma.application.create({
      data: {
        borrowerId,
        productId,
        amountRequested: BigInt(requestedAmount),
        termDaysRequested,
        purpose,
        channel,
        externalRef,
        status: 'SUBMITTED',
      },
      include: { product: true },
    }),
  );
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 422 });

  const amountRequested = Number(application!.amountRequested);
  const product = application!.product;
  const aprBps = product?.defaultAprBps ?? 1800;
  const fixedFeeAmtCents = Number(product?.fixedFeeAmount ?? 0);
  const feePctBps = product?.feePctBps ?? 0;
  const aprPct = aprBps / 100;
  const termYears = termDaysRequested / 365;
  const principalRand = requestedAmount / 100;
  const initiationFeeRand = fixedFeeAmtCents > 0
    ? fixedFeeAmtCents / 100
    : (feePctBps / 10000) * principalRand;
  const estimatedTotalInterestRand = principalRand * (aprBps / 10000) * termYears;
  const totalCostOfCreditRand = principalRand + estimatedTotalInterestRand + initiationFeeRand;

  const responseBody = {
    ...application!,
    amountRequested,
    ncrDisclosure: {
      annualPercentageRatePct: Number(aprPct.toFixed(2)),
      initiationFeeRand: Number(initiationFeeRand.toFixed(2)),
      estimatedTotalInterestRand: Number(estimatedTotalInterestRand.toFixed(2)),
      totalCostOfCreditRand: Number(totalCostOfCreditRand.toFixed(2)),
      disclaimer: 'Estimate only. Final figures confirmed at approval per NCA s.92.',
    },
  };

  if (idempotencyKey) {
    await redis.set(`idempotency:${idempotencyKey}`, responseBody, { ex: IDEMPOTENCY_TTL });
  }

  await inngest.send({ name: 'application/created', data: { applicationId: application!.id } }).catch(() => {
    // Underwriting can be retried manually if background orchestration is unavailable.
  });

  return NextResponse.json(responseBody, { status: 201 });
}

export async function GET(req: NextRequest) {
  const auth = await authorizeOpsRequest(req, APPLICATION_READ_ROLES);
  if (!auth.ok) {
    return auth.response;
  }

  const { prisma } = await import('@capstack/db');
  const { searchParams } = new URL(req.url);
  const workflowStatus = (searchParams.get('status') ?? 'ALL') as WorkflowStatus;
  const q = searchParams.get('q')?.trim() ?? '';
  const borrowerId = searchParams.get('borrowerId') ?? undefined;
  const take = Math.min(Number(searchParams.get('limit') ?? 20), 100);
  const skip = Number(searchParams.get('offset') ?? 0);
  const sortBy = searchParams.get('sortBy') ?? 'submittedAt';
  const sortDirection: 'asc' | 'desc' = searchParams.get('sortDirection') === 'asc' ? 'asc' : 'desc';

  const baseWhere = {
    product: { is: { lenderId: auth.identity.lenderId } },
    ...(borrowerId && { borrowerId }),
    ...(q && {
      OR: [
        { externalRef: { contains: q, mode: 'insensitive' as const } },
        { borrower: { is: { email: { contains: q, mode: 'insensitive' as const } } } },
        { borrower: { is: { individual: { is: { fullName: { contains: q, mode: 'insensitive' as const } } } } } },
        { borrower: { is: { business: { is: { legalName: { contains: q, mode: 'insensitive' as const } } } } } },
        { loan: { is: { loanNumber: { contains: q, mode: 'insensitive' as const } } } },
      ],
    }),
  };

  const where = buildWorkflowWhere(workflowStatus, baseWhere);
  const orderBy = sortBy === 'amountRequested'
    ? { amountRequested: sortDirection }
    : sortBy === 'termDaysRequested'
      ? { termDaysRequested: sortDirection }
      : { submittedAt: sortDirection };

  const [err, result] = await to(
    Promise.all([
      prisma.application.findMany({
        where,
        select: {
          id: true,
          borrowerId: true,
          externalRef: true,
          status: true,
          amountRequested: true,
          termDaysRequested: true,
          submittedAt: true,
          borrower: {
            select: {
              id: true,
              type: true,
              email: true,
              individual: { select: { fullName: true, idNumber: true, monthlyIncome: true } },
              business: { select: { legalName: true, monthlyTurnover: true } },
              consents: { where: { scope: 'BUREAU' }, select: { revokedAt: true } },
              kycChecks: { orderBy: { createdAt: 'desc' }, take: 5, select: { status: true } },
            },
          },
          product: {
            select: {
              id: true,
              name: true,
              defaultAprBps: true,
              amortizationMethod: true,
            },
          },
          loan: { select: { id: true, status: true, loanNumber: true } },
          decisions: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              id: true,
              recommendation: true,
              pdScore: true,
              lgdScore: true,
              expectedLoss: true,
              riskBand: true,
              approvedAmount: true,
              approvedTermDays: true,
              approvedAprBps: true,
              reasonCodes: true,
              policyExceptions: true,
              modelVersion: true,
              createdAt: true,
            },
          },
          events: {
            orderBy: { createdAt: 'desc' },
            take: 8,
            select: {
              id: true,
              type: true,
              actor: true,
              payload: true,
              createdAt: true,
            },
          },
        },
        orderBy,
        take,
        skip,
      }),
      prisma.application.count({ where }),
      prisma.application.groupBy({
        by: ['status'],
        where: buildWorkflowWhere('ALL', baseWhere),
        _count: { _all: true },
      }),
      prisma.application.count({ where: buildWorkflowWhere('APPROVED', baseWhere) }),
      prisma.application.count({ where: buildWorkflowWhere('PENDING_DISBURSEMENT', baseWhere) }),
    ]),
  );
  if (err) return NextResponse.json({ error: err.message }, { status: 500 });

  const [applications, total, groupedStatusCounts, approvedCount, pendingCount] = result!;
  const countsByStatus = groupedStatusCounts.reduce<Record<string, number>>((accumulator, item) => {
    accumulator[item.status] = item._count._all;
    return accumulator;
  }, {});
  const allCount = Object.values(countsByStatus).reduce((sum, count) => sum + count, 0);
  const submittedCount = REVIEW_QUEUE_STATUSES.reduce((sum, status) => sum + (countsByStatus[status] ?? 0), 0);
  const rejectedCount = countsByStatus.REJECTED ?? 0;
  const borrowerIds = [...new Set(applications.map((application) => application.borrowerId))];
  const [amlErr, amlAlerts] = borrowerIds.length === 0
    ? [null, [] as Array<{ borrowerId: string | null; severity: string; type: string }>]
    : await to(
        prisma.amlAlert.findMany({
          where: {
            borrowerId: { in: borrowerIds },
            status: 'OPEN',
          },
          select: {
            borrowerId: true,
            severity: true,
            type: true,
          },
        }),
      );
  if (amlErr) return NextResponse.json({ error: amlErr.message }, { status: 500 });

  const alertsByBorrower = (amlAlerts ?? []).reduce<Record<string, Array<{ severity: string; type: string }>>>(
    (accumulator, alert) => {
      if (alert.borrowerId) {
        accumulator[alert.borrowerId] = [...(accumulator[alert.borrowerId] ?? []), alert];
      }
      return accumulator;
    },
    {},
  );

  const data = applications.map((application) => {
    const amountRequestedCents = Number(application.amountRequested);
    const workflow = deriveWorkflowStatus(application.status, application.loan?.status);
    const assignment = extractLatestAssignment(application.events);
    const flag = extractLatestFlag(application.events);
    const notes = extractNotes(application.events);
    const decision = application.decisions[0]
      ? {
          ...application.decisions[0],
          approvedAmount: application.decisions[0].approvedAmount != null
            ? Number(application.decisions[0].approvedAmount)
            : null,
        }
      : null;
    const bureau = buildBureauSummary({
      eligible: application.borrower.type === 'INDIVIDUAL' && !!application.borrower.individual?.idNumber,
      hasConsent: application.borrower.consents.some((consent) => consent.revokedAt == null),
      events: application.events,
    });
    const underwriting = buildAiSummary({
      amountRequestedCents,
      termDaysRequested: application.termDaysRequested,
      defaultAprBps: application.product.defaultAprBps,
      amortizationMethod: application.product.amortizationMethod,
      decision,
    });
    const monthlyIncomeCents = application.borrower.individual?.monthlyIncome != null
      ? Number(application.borrower.individual.monthlyIncome)
      : application.borrower.business?.monthlyTurnover != null
        ? Number(application.borrower.business.monthlyTurnover)
        : null;
    const affordability = buildAffordabilitySummary({
      monthlyIncomeCents,
      monthlyExpensesCents: monthlyIncomeCents != null
        ? Math.round(monthlyIncomeCents / (application.borrower.type === 'BUSINESS' ? 2 : 3))
        : null,
      monthlyObligationsCents: bureau.monthlyObligations != null ? Math.round(bureau.monthlyObligations * 100) : 0,
      amountRequestedCents: underwriting.recommendedOffer.amountCents,
      termDaysRequested: underwriting.recommendedOffer.termDays,
      aprBps: underwriting.recommendedOffer.aprBps,
      amortizationMethod: application.product.amortizationMethod,
      source: application.borrower.individual?.monthlyIncome != null
        ? 'DECLARED_INCOME'
        : application.borrower.business?.monthlyTurnover != null
          ? 'TURNOVER_FALLBACK'
          : 'UNAVAILABLE',
    });
    const kycStatus = summarizeKycStatus(application.borrower.kycChecks.map((check) => check.status));
    const amlRisk = summarizeAmlRisk(alertsByBorrower[application.borrower.id] ?? []);
    const ageHours = getAgeHours(application.submittedAt);
    const approvalTier = getApprovalTier({
      amountRequestedCents,
      amlRisk,
      kycStatus,
      riskBand: underwriting.riskBand,
      canAfford: affordability.canAfford,
    });
    const reviewPriority = amlRisk === 'HIGH'
      || kycStatus === 'MANUAL_REVIEW'
      || bureau.status === 'FAILED'
      || underwriting.riskBand === 'D'
      || underwriting.riskBand === 'E'
      ? 'HIGH'
      : getSlaStatus(ageHours, workflow) === 'BREACHED'
        ? 'MEDIUM'
        : 'LOW';

    return {
      id: application.id,
      externalRef: application.externalRef,
      status: application.status,
      workflowStatus: workflow,
      amountRequested: amountRequestedCents,
      termDaysRequested: application.termDaysRequested,
      submittedAt: application.submittedAt,
      borrower: {
        id: application.borrower.id,
        email: application.borrower.email,
        type: application.borrower.type,
        individual: application.borrower.individual,
        business: application.borrower.business,
      },
      product: application.product,
      loan: application.loan,
      canApprove: !application.loan && ['SUBMITTED', 'UNDER_REVIEW', 'HUMAN_REVIEW', 'AUTO_DECISIONED'].includes(application.status),
      canReject: !application.loan && !['REJECTED', 'APPROVED', 'CANCELLED', 'EXPIRED'].includes(application.status),
      latestDecision: decision,
      assignee: assignment,
      flag,
      noteCount: notes.length,
      ageHours,
      slaStatus: getSlaStatus(ageHours, workflow),
      approvalTier,
      reviewPriority,
      underwriting,
      compliance: {
        kycStatus,
        amlRisk,
        bureauStatus: bureau.status,
        bureauScore: bureau.bureauScore,
      },
      affordability,
    };
  });

  return NextResponse.json({
    data,
    count: data.length,
    total,
    statusCounts: {
      ALL: allCount,
      SUBMITTED: submittedCount,
      APPROVED: approvedCount,
      REJECTED: rejectedCount,
      PENDING_DISBURSEMENT: pendingCount,
    },
  });
}