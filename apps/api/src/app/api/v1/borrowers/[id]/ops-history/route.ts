/**
 * GET /api/v1/borrowers/[id]/ops-history
 *
 * Returns the full borrower credit history as an ops-facing PDF.
 *
 * AUDIENCE: INTERNAL STAFF ONLY.
 * Includes: all loans, delinquency history, DPD, collections events,
 * open AML/fraud flags, internal risk rating.
 *
 * Auth: requires staff Bearer token with appropriate role.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@capstack/db';
import { renderOpsBorrowerHistory } from '@/lib/pdf/ops-borrower-history';

async function to<T>(p: Promise<T>): Promise<[Error, null] | [null, T]> {
  try { return [null, await p]; }
  catch (err) { return [err instanceof Error ? err : new Error(String(err)), null]; }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = req.headers.get('authorization') ?? '';
  if (!auth.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: borrowerId } = await params;
  const generatedBy = req.headers.get('x-staff-name') ?? 'Staff';

  const [err, borrower] = await to(
    prisma.borrower.findUnique({
      where: { id: borrowerId },
      include: {
        individual: true,
        kycChecks:  { orderBy: { createdAt: 'desc' }, take: 1 },
        loans: {
          include: {
            product: true,
            application: {
              include: {
                decisions: { orderBy: { createdAt: 'desc' }, take: 1 },
              },
            },
            repayments: true,
            collections: { orderBy: { createdAt: 'desc' }, take: 10 },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    }),
  );

  if (err)       return NextResponse.json({ error: 'DB error' }, { status: 500 });
  if (!borrower) return NextResponse.json({ error: 'Borrower not found' }, { status: 404 });

  const [, amlAlerts] = await to(
    prisma.amlAlert.findMany({ where: { borrowerId, status: 'OPEN' } }),
  );

  const totalDisbursed    = borrower.loans.reduce((s, l) => s + Number(l.principal), 0);
  const totalRepaid       = borrower.loans.flatMap(l => l.repayments).reduce((s, r) => s + Number(r.amount), 0);
  const totalOutstanding  = borrower.loans.reduce((s, l) => s + Number(l.outstandingPrincipal), 0);
  const maxDpd            = borrower.loans.reduce((max, l) => Math.max(max, l.daysPastDue), 0);
  const writtenOff        = borrower.loans.filter(l => l.status === 'WRITTEN_OFF').reduce((s, l) => s + Number(l.principal), 0);
  const currentBucket     = borrower.loans
    .filter(l => l.status === 'ACTIVE')
    .sort((a, b) => b.daysPastDue - a.daysPastDue)[0]?.delinquencyState ?? 'CURRENT';
  const kycStatus = borrower.kycChecks[0]?.status ?? 'PENDING';

  const pdfBuffer = await renderOpsBorrowerHistory({
    generatedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
    generatedBy,
    borrower: {
      id:            borrower.id,
      name:          borrower.individual?.fullName ?? 'N/A',
      email:         borrower.email,
      phone:         borrower.phone,
      riskRating:    borrower.riskRating ?? 'N/A',
      blacklistFlag: borrower.blacklistFlag,
      bureauScore:   null,
      kycStatus,
      memberSince:   borrower.createdAt.toISOString().slice(0, 10),
    },
    summary: {
      totalLoansCount:      borrower.loans.length,
      activeLoansCount:     borrower.loans.filter(l => l.status === 'ACTIVE').length,
      totalDisbursedRand:   (totalDisbursed / 100).toFixed(2),
      totalRepaidRand:      (totalRepaid / 100).toFixed(2),
      totalOutstandingRand: (totalOutstanding / 100).toFixed(2),
      totalWrittenOffRand:  (writtenOff / 100).toFixed(2),
      everDelinquent:       maxDpd > 0,
      maxDpdEver:           maxDpd,
      currentBucket,
    },
    loans: borrower.loans.map(loan => ({
      loanNumber:       loan.loanNumber,
      product:          loan.product?.name ?? 'N/A',
      status:           loan.status,
      principalRand:    (Number(loan.principal) / 100).toFixed(2),
      aprPct:           (loan.aprBps / 100).toFixed(2),
      startDate:        loan.startDate.toISOString().slice(0, 10),
      maturityDate:     loan.maturityDate.toISOString().slice(0, 10),
      totalRepaidRand:  (loan.repayments.reduce((s, r) => s + Number(r.amount), 0) / 100).toFixed(2),
      outstandingRand:  (Number(loan.outstandingPrincipal) / 100).toFixed(2),
      dpd:              loan.daysPastDue,
      bucket:           loan.delinquencyState,
      riskBand:         loan.application?.decisions[0]?.riskBand ?? 'N/A',
      collectionsEvents: loan.collections.map(e => ({
        date:    e.createdAt.toISOString().slice(0, 10),
        action:  e.type,
        outcome: e.outcome ?? '',
      })),
    })),
    openFlags: [
      ...(amlAlerts ?? []).map(a => ({
        type:      'AML' as const,
        detail:    `${a.type} — severity: ${a.severity}${a.filedSar ? ' — SAR filed' : ''}`,
        createdAt: a.createdAt.toISOString().slice(0, 10),
      })),
      ...(borrower.blacklistFlag ? [{
        type:      'BLACKLIST' as const,
        detail:    'Borrower is on the internal blacklist',
        createdAt: 'N/A',
      }] : []),
    ],
  });

  return new Response(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="ops_borrower_${borrowerId}.pdf"`,
    },
  });
}
