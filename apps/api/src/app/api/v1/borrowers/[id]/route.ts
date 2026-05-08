import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@capstack/db';

async function to<T>(p: Promise<T>): Promise<[Error, null] | [null, T]> {
  try { return [null, await p]; }
  catch (err) { return [err instanceof Error ? err : new Error(String(err)), null]; }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [err, borrower] = await to(
    prisma.borrower.findUnique({
      where:   { id },
      include: {
        individual:   true,
        business:     { include: { directors: true } },
        applications: { orderBy: { submittedAt: 'desc' }, take: 10 },
        loans:        { orderBy: { createdAt: 'desc' }, take: 10 },
        kycChecks:    { orderBy: { createdAt: 'desc' }, take: 5 },
        bankAccounts: true,
      },
    }),
  ) as [Error, null] | [null, (import('@capstack/db').Borrower & {
    individual: import('@capstack/db').IndividualBorrower | null;
    business: (import('@capstack/db').BusinessBorrower & { directors: import('@capstack/db').BusinessDirector[] }) | null;
    applications: import('@capstack/db').Application[];
    loans: import('@capstack/db').Loan[];
    kycChecks: import('@capstack/db').KycCheck[];
    bankAccounts: import('@capstack/db').LinkedBankAccount[];
  }) | null];

  if (err) return NextResponse.json({ error: err.message }, { status: 500 });
  if (!borrower) return NextResponse.json({ error: 'Borrower not found' }, { status: 404 });

  return NextResponse.json({
    ...borrower,
    individual: borrower.individual ? {
      ...borrower.individual,
      monthlyIncome: borrower.individual.monthlyIncome ? Number(borrower.individual.monthlyIncome) : null,
    } : null,
    business: borrower.business ? {
      ...borrower.business,
      monthlyTurnover: borrower.business.monthlyTurnover ? Number(borrower.business.monthlyTurnover) : null,
    } : null,
    loans: borrower.loans.map((l: import('@capstack/db').Loan) => ({
      ...l,
      principal:            Number(l.principal),
      outstandingPrincipal: Number(l.outstandingPrincipal),
      outstandingInterest:  Number(l.outstandingInterest),
    })),
    applications: borrower.applications.map((a: import('@capstack/db').Application) => ({
      ...a,
      amountRequested: Number(a.amountRequested),
    })),
  });
}
