import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@capstack/db';
import { authorizeOpsRequest } from '@/lib/ops-auth';
import { summarizeAmlRisk } from '@/lib/application-review';

async function to<T>(p: Promise<T>): Promise<[Error, null] | [null, T]> {
  try {
    return [null, await p];
  } catch (err) {
    return [err instanceof Error ? err : new Error(String(err)), null];
  }
}

const COMPLIANCE_ROLES = ['ADMIN', 'COMPLIANCE', 'UNDERWRITER', 'CREDIT_OFFICER', 'READONLY'];

export async function GET(req: NextRequest) {
  const auth = await authorizeOpsRequest(req, COMPLIANCE_ROLES);
  if (!auth.ok) {
    return auth.response;
  }

  const [kycErr, kycChecks] = await to(
    prisma.kycCheck.findMany({
      orderBy: { createdAt: 'desc' },
      take: 400,
      include: {
        borrower: {
          include: {
            individual: true,
            business: true,
          },
        },
      },
    }),
  );
  const [amlErr, amlAlerts] = await to(
    prisma.amlAlert.findMany({
      orderBy: { createdAt: 'desc' },
      take: 300,
      where: { borrowerId: { not: null } },
      select: {
        id: true,
        borrowerId: true,
        type: true,
        severity: true,
        details: true,
        status: true,
        filedSar: true,
        reviewedAt: true,
        createdAt: true,
      },
    }),
  );

  if (kycErr || amlErr) {
    return NextResponse.json({ error: kycErr?.message ?? amlErr?.message ?? 'Unable to load compliance queue.' }, { status: 500 });
  }

  const borrowerMap = new Map<string, {
    borrowerId: string;
    name: string;
    email: string;
    phone: string;
    idNumber: string | null;
    checks: typeof kycChecks;
    alerts: Array<(typeof amlAlerts)[number]>;
  }>();

  for (const check of kycChecks ?? []) {
    const borrower = check.borrower;
    const name = borrower.individual?.fullName ?? borrower.business?.legalName ?? borrower.email;
    const entry = borrowerMap.get(check.borrowerId) ?? {
      borrowerId: check.borrowerId,
      name,
      email: borrower.email,
      phone: borrower.phone,
      idNumber: borrower.individual?.idNumber ?? null,
      checks: [],
      alerts: [],
    };
    entry.checks.push(check);
    borrowerMap.set(check.borrowerId, entry);
  }

  const missingBorrowerIds = [...new Set((amlAlerts ?? []).map((alert) => alert.borrowerId).filter((id): id is string => !!id && !borrowerMap.has(id)))];
  if (missingBorrowerIds.length > 0) {
    const [borrowerErr, borrowers] = await to(
      prisma.borrower.findMany({
        where: { id: { in: missingBorrowerIds } },
        include: { individual: true, business: true },
      }),
    );
    if (borrowerErr) {
      return NextResponse.json({ error: borrowerErr.message }, { status: 500 });
    }
    for (const borrower of borrowers ?? []) {
      borrowerMap.set(borrower.id, {
        borrowerId: borrower.id,
        name: borrower.individual?.fullName ?? borrower.business?.legalName ?? borrower.email,
        email: borrower.email,
        phone: borrower.phone,
        idNumber: borrower.individual?.idNumber ?? null,
        checks: [],
        alerts: [],
      });
    }
  }

  for (const alert of amlAlerts ?? []) {
    if (!alert.borrowerId) continue;
    const entry = borrowerMap.get(alert.borrowerId);
    if (entry) {
      entry.alerts.push(alert);
    }
  }

  const cases = [...borrowerMap.values()].map((entry) => {
    const latestByType = new Map<string, (typeof entry.checks)[number]>();
    for (const check of entry.checks) {
      if (!latestByType.has(check.type)) {
        latestByType.set(check.type, check);
      }
    }

    const idCheck = latestByType.get('ID_VERIFICATION') ?? null;
    const addressCheck = latestByType.get('ADDRESS_VERIFICATION') ?? null;
    const livenessCheck = latestByType.get('LIVENESS') ?? null;
    const sanctionsCheck = latestByType.get('SANCTIONS') ?? null;
    const pepCheck = latestByType.get('PEP') ?? null;
    const amlRisk = summarizeAmlRisk(entry.alerts.map((alert) => ({ severity: alert.severity })));
    const factors = [
      ...entry.alerts.map((alert) => `${alert.type} (${alert.severity})`),
      ...entry.checks
        .filter((check) => ['FAILED', 'MANUAL_REVIEW'].includes(check.status))
        .map((check) => `${check.type} ${check.status.toLowerCase().replace(/_/g, ' ')}`),
    ];
    const auditTrail = [
      ...entry.checks.map((check) => ({
        id: check.id,
        type: 'KYC_CHECK',
        label: check.type,
        status: check.status,
        createdAt: check.createdAt.toISOString(),
        details: check.outcome ?? check.failureReason ?? null,
      })),
      ...entry.alerts.map((alert) => ({
        id: alert.id,
        type: 'AML_ALERT',
        label: alert.type,
        status: alert.status,
        createdAt: alert.createdAt.toISOString(),
        details: typeof alert.details === 'string' ? alert.details : JSON.stringify(alert.details),
      })),
    ]
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
      .slice(0, 10);

    return {
      borrowerId: entry.borrowerId,
      borrower: {
        name: entry.name,
        email: entry.email,
        phone: entry.phone,
        idNumber: entry.idNumber,
      },
      ficaDocuments: {
        idVerification: summarizeCheck(idCheck),
        proofOfAddress: summarizeCheck(addressCheck),
        liveness: summarizeCheck(livenessCheck),
      },
      sanctions: {
        sanctions: summarizeScreeningCheck(sanctionsCheck),
        pep: summarizeScreeningCheck(pepCheck),
        ofacStatus: summarizeListStatus(sanctionsCheck, ['OFAC']),
        unStatus: summarizeListStatus(sanctionsCheck, ['UN', 'UNITED_NATIONS']),
      },
      aml: {
        riskRating: amlRisk,
        factors: factors.length > 0 ? factors : ['No open compliance risk factors'],
        openAlertCount: entry.alerts.filter((alert) => alert.status === 'OPEN').length,
        filedSarCount: entry.alerts.filter((alert) => alert.filedSar).length,
      },
      auditTrail,
      lastUpdatedAt: auditTrail[0]?.createdAt ?? null,
    };
  }).sort((left, right) => {
    const riskOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;
    return riskOrder[left.aml.riskRating] - riskOrder[right.aml.riskRating];
  });

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    summary: {
      totalBorrowers: cases.length,
      highRiskBorrowers: cases.filter((entry) => entry.aml.riskRating === 'HIGH').length,
      pendingFicaDocs: cases.filter((entry) => ['PENDING', 'IN_PROGRESS', 'MANUAL_REVIEW'].includes(entry.ficaDocuments.idVerification.status)
        || ['PENDING', 'IN_PROGRESS', 'MANUAL_REVIEW'].includes(entry.ficaDocuments.proofOfAddress.status)
        || ['PENDING', 'IN_PROGRESS', 'MANUAL_REVIEW'].includes(entry.ficaDocuments.liveness.status)).length,
      sanctionsHits: cases.filter((entry) => entry.sanctions.sanctions.status === 'FAILED' || entry.sanctions.pep.status === 'FAILED').length,
      openAlerts: cases.reduce((sum, entry) => sum + entry.aml.openAlertCount, 0),
    },
    cases,
  });
}

function summarizeCheck(check: {
  status: string;
  provider: string;
  outcome: string | null;
  completedAt: Date | null;
  createdAt: Date;
} | null) {
  if (!check) {
    return { status: 'PENDING', provider: 'Not started', outcome: null, checkedAt: null };
  }

  return {
    status: check.status,
    provider: check.provider,
    outcome: check.outcome,
    checkedAt: (check.completedAt ?? check.createdAt).toISOString(),
  };
}

function summarizeScreeningCheck(check: {
  status: string;
  provider: string;
  outcome: string | null;
  rawResult: unknown;
  failureReason: string | null;
  completedAt: Date | null;
  createdAt: Date;
} | null) {
  if (!check) {
    return { status: 'PENDING', provider: 'Not started', result: 'Awaiting screening', checkedAt: null };
  }

  const details = asObject(check.rawResult);
  const lists = Array.isArray(details?.lists)
    ? details.lists.join(', ')
    : typeof details?.lists === 'string'
      ? details.lists
      : null;

  return {
    status: check.status,
    provider: check.provider,
    result: check.failureReason ?? check.outcome ?? lists ?? 'No hit recorded',
    checkedAt: (check.completedAt ?? check.createdAt).toISOString(),
  };
}

function summarizeListStatus(check: { status: string; rawResult: unknown } | null, aliases: string[]) {
  if (!check) return 'Not checked';
  const details = asObject(check.rawResult);
  const lists = Array.isArray(details?.lists)
    ? details.lists.map((item) => String(item).toUpperCase())
    : typeof details?.lists === 'string'
      ? [details.lists.toUpperCase()]
      : [];
  return aliases.some((alias) => lists.includes(alias)) ? 'Hit' : check.status === 'FAILED' ? 'Hit' : 'Clear';
}

function asObject(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}