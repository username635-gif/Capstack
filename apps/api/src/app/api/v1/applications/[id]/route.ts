import { NextRequest, NextResponse } from 'next/server';
import { authorizeOpsRequest } from '@/lib/ops-auth';
import {
  REVIEW_QUEUE_STATUSES,
  buildAffordabilitySummary,
  buildAiSummary,
  buildBureauSummary,
  buildReferenceNumber,
  deriveWorkflowStatus,
  extractLatestAssignment,
  extractNotes,
  getAgeHours,
  getApprovalTier,
  getSlaStatus,
  summarizeAmlRisk,
  summarizeKycStatus,
} from '@/lib/application-review';

const APPLICATION_READ_ROLES = ['ADMIN', 'UNDERWRITER', 'CREDIT_OFFICER', 'COMPLIANCE', 'FINANCE', 'READONLY'];

async function to<T>(p: Promise<T>): Promise<[Error, null] | [null, T]> {
  try {
    return [null, await p];
  } catch (err) {
    return [err instanceof Error ? err : new Error(String(err)), null];
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeOpsRequest(req, APPLICATION_READ_ROLES);
  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await params;
  const { prisma } = await import('@capstack/db');
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86_400_000);

  const [err, application] = await to(
    prisma.application.findFirst({
      where: {
        id,
        product: { is: { lenderId: auth.identity.lenderId } },
      },
      select: {
        id: true,
        externalRef: true,
        status: true,
        amountRequested: true,
        termDaysRequested: true,
        submittedAt: true,
        decidedAt: true,
        purpose: true,
        channel: true,
        borrower: {
          select: {
            id: true,
            type: true,
            email: true,
            phone: true,
            riskRating: true,
            blacklistFlag: true,
            individual: {
              select: {
                fullName: true,
                idNumber: true,
                dateOfBirth: true,
                monthlyIncome: true,
                employmentStatus: true,
                employer: true,
                occupation: true,
                nationality: true,
              },
            },
            business: {
              select: {
                legalName: true,
                tradingName: true,
                registrationNumber: true,
                industry: true,
                founded: true,
                monthlyTurnover: true,
                numberOfEmployees: true,
              },
            },
            consents: {
              where: { scope: 'BUREAU' },
              select: {
                scope: true,
                grantedAt: true,
                revokedAt: true,
              },
            },
            kycChecks: {
              orderBy: { createdAt: 'desc' },
              take: 10,
              select: {
                id: true,
                type: true,
                provider: true,
                status: true,
                outcome: true,
                failureReason: true,
                createdAt: true,
                completedAt: true,
              },
            },
            bankAccounts: {
              select: {
                id: true,
                provider: true,
                bankName: true,
                isVerified: true,
                statements: {
                  orderBy: { periodEnd: 'desc' },
                  select: {
                    id: true,
                    periodStart: true,
                    periodEnd: true,
                    isVerified: true,
                  },
                },
                transactions: {
                  where: { date: { gte: ninetyDaysAgo } },
                  orderBy: { date: 'desc' },
                  select: {
                    amount: true,
                    type: true,
                    date: true,
                  },
                },
              },
            },
            documents: {
              orderBy: { createdAt: 'desc' },
              take: 10,
              select: {
                id: true,
                type: true,
                fileName: true,
                parsedData: true,
                createdAt: true,
              },
            },
            notifications: {
              orderBy: { createdAt: 'desc' },
              take: 10,
              select: {
                id: true,
                type: true,
                channel: true,
                subject: true,
                body: true,
                status: true,
                externalRef: true,
                createdAt: true,
                sentAt: true,
              },
            },
          },
        },
        product: {
          select: {
            id: true,
            name: true,
            minAmount: true,
            maxAmount: true,
            minTermDays: true,
            maxTermDays: true,
            defaultAprBps: true,
            amortizationMethod: true,
          },
        },
        loan: {
          select: {
            id: true,
            status: true,
            loanNumber: true,
            principal: true,
            aprBps: true,
            termDays: true,
            startDate: true,
            maturityDate: true,
            disbursedAt: true,
            outstandingPrincipal: true,
            outstandingInterest: true,
            outstandingFees: true,
          },
        },
        decisions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            modelVersion: true,
            pdScore: true,
            lgdScore: true,
            expectedLoss: true,
            riskBand: true,
            recommendation: true,
            approvedAmount: true,
            approvedTermDays: true,
            approvedAprBps: true,
            reasonCodes: true,
            policyExceptions: true,
            shapValues: true,
            createdAt: true,
            decisionMaker: {
              select: {
                fullName: true,
                role: true,
              },
            },
          },
        },
        events: {
          orderBy: { createdAt: 'desc' },
          take: 25,
          select: {
            id: true,
            type: true,
            actor: true,
            payload: true,
            createdAt: true,
          },
        },
      },
    }),
  );

  if (err) return NextResponse.json({ error: err.message }, { status: 500 });
  if (!application) return NextResponse.json({ error: 'Application not found' }, { status: 404 });

  const [amlErr, amlAlerts] = await to(
    prisma.amlAlert.findMany({
      where: {
        borrowerId: application.borrower.id,
        status: 'OPEN',
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        type: true,
        severity: true,
        status: true,
        details: true,
        filedSar: true,
        createdAt: true,
      },
    }),
  );
  if (amlErr) return NextResponse.json({ error: amlErr.message }, { status: 500 });

  const [auditErr, auditTrail] = await to(
    prisma.auditLog.findMany({
      where: {
        resource: 'APPLICATION',
        resourceId: id,
      },
      orderBy: { createdAt: 'desc' },
      take: 15,
      select: {
        id: true,
        actor: true,
        actorType: true,
        action: true,
        before: true,
        after: true,
        createdAt: true,
      },
    }),
  );
  if (auditErr) return NextResponse.json({ error: auditErr.message }, { status: 500 });

  const latestDecision = application.decisions[0]
    ? {
        ...application.decisions[0],
        approvedAmount: application.decisions[0].approvedAmount != null
          ? Number(application.decisions[0].approvedAmount)
          : null,
      }
    : null;
  const workflowStatus = deriveWorkflowStatus(application.status, application.loan?.status);
  const canApprove = !application.loan && REVIEW_QUEUE_STATUSES.includes(application.status as (typeof REVIEW_QUEUE_STATUSES)[number]);
  const canReject = !application.loan && !['REJECTED', 'APPROVED', 'CANCELLED', 'EXPIRED'].includes(application.status);
  const borrowerDisplayName = application.borrower.individual?.fullName
    ?? application.borrower.business?.legalName
    ?? application.borrower.email;
  const assignment = extractLatestAssignment(application.events);
  const notes = extractNotes(application.events);
  const bureau = buildBureauSummary({
    eligible: application.borrower.type === 'INDIVIDUAL' && !!application.borrower.individual?.idNumber,
    hasConsent: application.borrower.consents.some((consent) => consent.revokedAt == null),
    events: application.events,
  });
  const underwriting = buildAiSummary({
    amountRequestedCents: Number(application.amountRequested),
    termDaysRequested: application.termDaysRequested,
    defaultAprBps: application.product.defaultAprBps,
    amortizationMethod: application.product.amortizationMethod,
    decision: latestDecision,
  });
  const allTransactions = application.borrower.bankAccounts.flatMap((account) => account.transactions);
  const totalCreditsCents = allTransactions
    .filter((transaction) => transaction.type === 'CREDIT')
    .reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  const totalDebitsCents = allTransactions
    .filter((transaction) => transaction.type !== 'CREDIT')
    .reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  const avgMonthlyCreditsCents = allTransactions.length > 0 ? Math.round(totalCreditsCents / 3) : null;
  const avgMonthlyDebitsCents = allTransactions.length > 0 ? Math.round(totalDebitsCents / 3) : null;
  const monthlyIncomeCents = avgMonthlyCreditsCents && avgMonthlyCreditsCents > 0
    ? avgMonthlyCreditsCents
    : application.borrower.individual?.monthlyIncome != null
      ? Number(application.borrower.individual.monthlyIncome)
      : application.borrower.business?.monthlyTurnover != null
        ? Number(application.borrower.business.monthlyTurnover)
        : null;
  const affordabilitySource = avgMonthlyCreditsCents && avgMonthlyCreditsCents > 0
    ? 'BANK_TRANSACTIONS' as const
    : application.borrower.individual?.monthlyIncome != null
      ? 'DECLARED_INCOME' as const
      : application.borrower.business?.monthlyTurnover != null
        ? 'TURNOVER_FALLBACK' as const
        : 'UNAVAILABLE' as const;
  const statements = application.borrower.bankAccounts.flatMap((account) => account.statements);
  const lastStatement = statements[0]?.periodEnd ? statements[0].periodEnd.toISOString() : null;
  const parsedDocumentCount = application.borrower.documents.filter((document) => document.parsedData != null).length;
  const affordability = buildAffordabilitySummary({
    monthlyIncomeCents,
    monthlyExpensesCents: avgMonthlyDebitsCents
      ?? (monthlyIncomeCents != null
        ? Math.round(monthlyIncomeCents / (application.borrower.type === 'BUSINESS' ? 2 : 3))
        : null),
    monthlyObligationsCents: bureau.monthlyObligations != null ? Math.round(bureau.monthlyObligations * 100) : 0,
    amountRequestedCents: underwriting.recommendedOffer.amountCents,
    termDaysRequested: underwriting.recommendedOffer.termDays,
    aprBps: underwriting.recommendedOffer.aprBps,
    amortizationMethod: application.product.amortizationMethod,
    source: affordabilitySource,
    avgMonthlyCreditsCents,
    avgMonthlyDebitsCents,
    bankStatementsTotal: statements.length,
    bankStatementsVerified: statements.filter((statement) => statement.isVerified).length,
    parsedDocumentCount,
    lastStatementAt: lastStatement,
  });
  const kycStatus = summarizeKycStatus(application.borrower.kycChecks.map((check) => check.status));
  const amlRisk = summarizeAmlRisk((amlAlerts ?? []).map((alert) => ({ severity: alert.severity })));
  const ageHours = getAgeHours(application.submittedAt);
  const approvalTier = getApprovalTier({
    amountRequestedCents: Number(application.amountRequested),
    amlRisk,
    kycStatus,
    riskBand: underwriting.riskBand,
    canAfford: affordability.canAfford,
  });

  return NextResponse.json({
    id: application.id,
    referenceNumber: buildReferenceNumber(application.id, application.externalRef, application.loan?.loanNumber),
    status: application.status,
    workflowStatus,
    amountRequested: Number(application.amountRequested),
    termDaysRequested: application.termDaysRequested,
    submittedAt: application.submittedAt,
    decidedAt: application.decidedAt,
    purpose: application.purpose,
    channel: application.channel,
    canApprove,
    canReject,
    borrower: {
      ...application.borrower,
      displayName: borrowerDisplayName,
      individual: application.borrower.individual ? {
        ...application.borrower.individual,
        monthlyIncome: application.borrower.individual.monthlyIncome != null
          ? Number(application.borrower.individual.monthlyIncome)
          : null,
      } : null,
      business: application.borrower.business ? {
        ...application.borrower.business,
        monthlyTurnover: application.borrower.business.monthlyTurnover != null
          ? Number(application.borrower.business.monthlyTurnover)
          : null,
      } : null,
    },
    product: {
      ...application.product,
      minAmount: Number(application.product.minAmount),
      maxAmount: Number(application.product.maxAmount),
    },
    loan: application.loan ? {
      ...application.loan,
      principal: Number(application.loan.principal),
      outstandingPrincipal: Number(application.loan.outstandingPrincipal),
      outstandingInterest: Number(application.loan.outstandingInterest),
      outstandingFees: Number(application.loan.outstandingFees),
    } : null,
    latestDecision: latestDecision ? {
      ...latestDecision,
      decisionMaker: latestDecision.decisionMaker,
    } : null,
    underwriting,
    affordability,
    compliance: {
      kycStatus,
      kycChecks: application.borrower.kycChecks.map((check) => ({
        ...check,
        createdAt: check.createdAt.toISOString(),
        completedAt: check.completedAt?.toISOString() ?? null,
      })),
      amlRisk,
      amlAlerts: (amlAlerts ?? []).map((alert) => ({
        ...alert,
        createdAt: alert.createdAt.toISOString(),
      })),
      bureau,
    },
    workflow: {
      assignee: assignment?.assignee ?? null,
      assignedAt: assignment?.assignedAt ?? null,
      ageHours,
      slaStatus: getSlaStatus(ageHours, workflowStatus),
      approvalTier,
      noteCount: notes.length,
      latestNote: notes[0]?.note ?? null,
    },
    notes,
    events: application.events.map((event) => ({
      ...event,
      createdAt: event.createdAt.toISOString(),
    })),
    auditTrail: (auditTrail ?? []).map((entry) => ({
      ...entry,
      createdAt: entry.createdAt.toISOString(),
    })),
    communications: application.borrower.notifications.map((notification) => ({
      ...notification,
      createdAt: notification.createdAt.toISOString(),
      sentAt: notification.sentAt?.toISOString() ?? null,
    })),
    bankAnalysis: {
      linkedAccountCount: application.borrower.bankAccounts.length,
      verifiedAccountCount: application.borrower.bankAccounts.filter((account) => account.isVerified).length,
      statementCount: statements.length,
      verifiedStatementCount: statements.filter((statement) => statement.isVerified).length,
      avgMonthlyCreditsCents,
      avgMonthlyDebitsCents,
      lastStatementAt: lastStatement,
      parsedDocumentCount,
    },
  });
}