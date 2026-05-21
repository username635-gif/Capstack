import { NextRequest, NextResponse } from 'next/server';
import { Prisma, prisma } from '@capstack/db';
import { authorizeOpsRequest } from '@/lib/ops-auth';

async function to<T>(p: Promise<T>): Promise<[Error, null] | [null, T]> {
  try {
    return [null, await p];
  } catch (err) {
    return [err instanceof Error ? err : new Error(String(err)), null];
  }
}

const READ_ROLES = ['ADMIN', 'CREDIT_OFFICER', 'UNDERWRITER', 'COLLECTIONS', 'COMPLIANCE', 'FINANCE', 'READONLY'];

export async function GET(req: NextRequest) {
  const auth = await authorizeOpsRequest(req, READ_ROLES);
  if (!auth.ok) {
    return auth.response;
  }

  const { searchParams } = new URL(req.url);

  // Parse query parameters
  const status = searchParams.get('status')?.toUpperCase() ?? undefined;
  const product = searchParams.get('product') ?? undefined;
  const minDpd = Number(searchParams.get('minDpd') ?? 0);
  const maxDpd = searchParams.get('maxDpd') ? Number(searchParams.get('maxDpd')) : undefined;
  const search = searchParams.get('search')?.trim() ?? undefined;
  const sortBy = searchParams.get('sortBy') ?? 'dpd';
  const sortOrder = (searchParams.get('sortOrder')?.toLowerCase() ?? 'desc') as 'asc' | 'desc';
  const page = Math.max(1, Number(searchParams.get('page') ?? 1));
  const pageSize = Math.min(Number(searchParams.get('pageSize') ?? 20), 100);

  // Build where clause
  const where: Prisma.LoanWhereInput = {
    AND: [
      // Status filter
      status ? { status: status as any } : {},

      // Product filter
      product ? { productId: product } : {},

      // DPD range filter
      {
        daysPastDue: {
          gte: minDpd,
          ...(maxDpd !== undefined && { lte: maxDpd }),
        },
      },

      // Search filter (loan number or borrower name)
      search
        ? {
            OR: [
              { loanNumber: { contains: search, mode: 'insensitive' } },
              {
                borrower: {
                  OR: [
                    { individual: { fullName: { contains: search, mode: 'insensitive' } } },
                    { business: { legalName: { contains: search, mode: 'insensitive' } } },
                  ],
                },
              },
            ],
          }
        : {},
    ],
  };

  // Build orderBy
  const orderBy: Prisma.LoanOrderByWithRelationInput[] = [];
  if (sortBy === 'dpd') {
    orderBy.push({ daysPastDue: sortOrder });
  } else if (sortBy === 'outstanding') {
    orderBy.push({ outstandingPrincipal: sortOrder });
  } else if (sortBy === 'createdAt') {
    orderBy.push({ createdAt: sortOrder });
  } else {
    orderBy.push({ daysPastDue: 'desc' });
  }
  orderBy.push({ updatedAt: 'desc' });

  // Query total count
  const [countErr, total] = await to(
    prisma.loan.count({
      where,
    }),
  );
  if (countErr) {
    return NextResponse.json({ error: countErr.message }, { status: 500 });
  }

  const summarizableLoans = { ...where };

  const [activeSummaryErr, activeSummary] = await to(
    prisma.loan.aggregate({
      _count: { _all: true },
      _sum: {
        outstandingPrincipal: true,
        outstandingInterest: true,
        outstandingFees: true,
      },
      where: {
        ...summarizableLoans,
        status: 'ACTIVE',
      },
    }),
  );
  if (activeSummaryErr) {
    return NextResponse.json({ error: activeSummaryErr.message }, { status: 500 });
  }

  const [atRiskSummaryErr, atRiskSummary] = await to(
    prisma.loan.aggregate({
      _count: { _all: true },
      _sum: {
        outstandingPrincipal: true,
        outstandingInterest: true,
        outstandingFees: true,
      },
      where: {
        ...summarizableLoans,
        daysPastDue: {
          gte: 30,
        },
      },
    }),
  );
  if (atRiskSummaryErr) {
    return NextResponse.json({ error: atRiskSummaryErr.message }, { status: 500 });
  }

  const [defaultedSummaryErr, defaultedSummary] = await to(
    prisma.loan.aggregate({
      _count: { _all: true },
      _sum: {
        outstandingPrincipal: true,
        outstandingInterest: true,
        outstandingFees: true,
      },
      where: {
        ...summarizableLoans,
        status: 'DEFAULTED',
      },
    }),
  );
  if (defaultedSummaryErr) {
    return NextResponse.json({ error: defaultedSummaryErr.message }, { status: 500 });
  }

  // Query loans with pagination
  const skip = (page - 1) * pageSize;
  const [loansErr, loans] = await to(
    prisma.loan.findMany({
      where,
      include: {
        borrower: {
          include: {
            individual: true,
            business: true,
          },
        },
        product: true,
        application: {
          include: {
            decisions: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: {
                id: true,
                recommendation: true,
                pdScore: true,
                riskBand: true,
                modelVersion: true,
                createdAt: true,
              },
            },
          },
        },
      },
      orderBy,
      take: pageSize,
      skip,
    }),
  );
  if (loansErr) {
    return NextResponse.json({ error: loansErr.message }, { status: 500 });
  }

  // Transform loans into response format
  const transformedLoans = loans!.map((loan) => {
    const borrowerName =
      loan.borrower.individual?.fullName ??
      loan.borrower.business?.legalName ??
      'Unknown borrower';

    const aiDecision = loan.application?.decisions[0] ?? null;

    return {
      id: loan.id,
      loanNumber: loan.loanNumber,
      status: loan.status,
      daysPastDue: loan.daysPastDue,
      principal: Number(loan.principal),
      outstandingPrincipal: Number(loan.outstandingPrincipal),
      outstandingInterest: Number(loan.outstandingInterest),
      outstandingFees: Number(loan.outstandingFees),
      outstandingTotal:
        Number(loan.outstandingPrincipal) +
        Number(loan.outstandingInterest) +
        Number(loan.outstandingFees),
      aprBps: Number(loan.aprBps),
      termDays: loan.termDays,
      disbursedAt: loan.disbursedAt?.toISOString() ?? null,
      maturityDate: loan.maturityDate?.toISOString() ?? null,
      borrower: {
        id: loan.borrowerId,
        name: borrowerName,
        email: loan.borrower.email,
        phone: loan.borrower.phone,
        riskRating: loan.borrower.riskRating,
        monthlyIncome:
          loan.borrower.individual?.monthlyIncome != null
            ? Number(loan.borrower.individual.monthlyIncome)
            : loan.borrower.business?.monthlyTurnover != null
              ? Number(loan.borrower.business.monthlyTurnover)
              : null,
      },
      product: {
        id: loan.product.id,
        name: loan.product.name,
        type: loan.product.type,
      },
      ai: aiDecision
        ? {
            decision: aiDecision.recommendation,
            confidence: aiDecision.pdScore,
            scoreband: aiDecision.riskBand,
            modelVersion: aiDecision.modelVersion,
            processedAt: aiDecision.createdAt.toISOString(),
          }
        : null,
    };
  });

  // Build KPI summary from entire filtered dataset, not only the current page
  const summary = {
    activeCount: activeSummary?._count?._all ?? 0,
    totalOutstanding:
      Number(activeSummary?._sum?.outstandingPrincipal ?? 0) +
      Number(activeSummary?._sum?.outstandingInterest ?? 0) +
      Number(activeSummary?._sum?.outstandingFees ?? 0),
    atRiskCount: atRiskSummary?._count?._all ?? 0,
    atRiskExposure:
      Number(atRiskSummary?._sum?.outstandingPrincipal ?? 0) +
      Number(atRiskSummary?._sum?.outstandingInterest ?? 0) +
      Number(atRiskSummary?._sum?.outstandingFees ?? 0),
    defaultedCount: defaultedSummary?._count?._all ?? 0,
    defaultedExposure:
      Number(defaultedSummary?._sum?.outstandingPrincipal ?? 0) +
      Number(defaultedSummary?._sum?.outstandingInterest ?? 0) +
      Number(defaultedSummary?._sum?.outstandingFees ?? 0),
  };

  return NextResponse.json({
    loans: transformedLoans,
    total,
    page,
    pageSize,
    summary,
  });
}
