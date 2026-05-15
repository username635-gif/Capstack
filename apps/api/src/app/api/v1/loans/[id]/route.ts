import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@capstack/db';

async function to<T>(p: Promise<T>): Promise<[Error, null] | [null, T]> {
  try { return [null, await p]; }
  catch (err) { return [err instanceof Error ? err : new Error(String(err)), null]; }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [err, loan] = await to(
    prisma.loan.findUnique({
      where:   { id },
      include: {
        product:          true,
        borrower:         { include: { individual: true, business: true } },
        schedule:         { orderBy: { dueDate: 'asc' } },
        repayments:       { orderBy: { receivedAt: 'desc' }, take: 20 },
        disbursements:    true,
        collections:      { orderBy: { createdAt: 'desc' }, take: 10 },
        restructureOffer: true,
      },
    }),
  );

  if (err) return NextResponse.json({ error: err.message }, { status: 500 });
  if (!loan) return NextResponse.json({ error: 'Loan not found' }, { status: 404 });

  return NextResponse.json({
    ...loan,
    principal:            Number(loan.principal),
    outstandingPrincipal: Number(loan.outstandingPrincipal),
    outstandingInterest:  Number(loan.outstandingInterest),
    schedule: loan.schedule.map(s => ({
      ...s,
      principalDue: Number(s.principalDue),
      interestDue:  Number(s.interestDue),
      totalDue:     Number(s.totalDue),
      paidAmount:   Number(s.paidAmount),
    })),
    repayments: loan.repayments.map(r => ({ ...r, amount: Number(r.amount) })),
    disbursements: loan.disbursements.map(d => ({ ...d, amount: Number(d.amount) })),
  });
}
