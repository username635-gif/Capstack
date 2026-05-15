import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@capstack/db';

async function to<T>(p: Promise<T>): Promise<[Error, null] | [null, T]> {
  try { return [null, await p]; }
  catch (err) { return [err instanceof Error ? err : new Error(String(err)), null]; }
}

function serializeLoan(loan: Record<string, unknown>) {
  return {
    ...loan,
    principalAmount:      Number(loan.principalAmount),
    outstandingPrincipal: Number(loan.outstandingPrincipal),
    outstandingInterest:  Number(loan.outstandingInterest),
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status     = searchParams.get('status') ?? undefined;
  const borrowerId = searchParams.get('borrowerId') ?? undefined;
  const take       = Math.min(Number(searchParams.get('limit') ?? 20), 100);
  const skip       = Number(searchParams.get('offset') ?? 0);

  const [err, loans] = await to(
    prisma.loan.findMany({
      where:   { ...(status && { status: status as import('@capstack/db').LoanStatus }), ...(borrowerId && { borrowerId }) },
      include: { product: true, borrower: { include: { individual: true } } },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    }),
  );
  if (err) return NextResponse.json({ error: err.message }, { status: 500 });

  const data = loans!.map(l => ({
    ...l,
    principal:            Number(l.principal),
    outstandingPrincipal: Number(l.outstandingPrincipal),
    outstandingInterest:  Number(l.outstandingInterest),
  }));
  return NextResponse.json({ data, count: data.length });
}
