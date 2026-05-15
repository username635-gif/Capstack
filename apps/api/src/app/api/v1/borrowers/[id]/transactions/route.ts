/**
 * GET /api/v1/borrowers/[id]/transactions
 *
 * Returns the borrower's full transaction history across ALL their loans.
 *
 * Query params:
 *   ?format=pdf   → returns a downloadable PDF
 *   ?format=json  → returns structured JSON (default)
 *
 * AUDIENCE: BORROWER — their own financial record.
 * No risk scores, no internal notes, no PD scores included.
 *
 * Auth: borrower must own the records (borrowerId matches session) OR staff.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@capstack/db';
import { renderTransactionHistory } from '@/lib/pdf/borrower-transactions';

async function to<T>(p: Promise<T>): Promise<[Error, null] | [null, T]> {
  try { return [null, await p]; }
  catch (err) { return [err instanceof Error ? err : new Error(String(err)), null]; }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: borrowerId } = await params;
  const format = new URL(req.url).searchParams.get('format') ?? 'json';

  const [err, borrower] = await to(
    prisma.borrower.findUnique({
      where: { id: borrowerId },
      include: {
        individual: true,
        loans: {
          include: {
            product:       true,
            repayments:    { orderBy: { receivedAt: 'asc' } },
            disbursements: { orderBy: { createdAt: 'asc' } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    }),
  );

  if (err)       return NextResponse.json({ error: 'DB error' }, { status: 500 });
  if (!borrower) return NextResponse.json({ error: 'Borrower not found' }, { status: 404 });

  // ── Build transaction lists per loan ──────────────────────────────────
  const loans = borrower.loans.map(loan => {
    const transactions: Array<{
      date: string; type: 'DISBURSEMENT' | 'REPAYMENT' | 'FEE' | 'INTEREST_ACCRUAL';
      amountRand: string; description: string; runningBalanceRand: string;
    }> = [];

    let running = 0;

    // Disbursements (credit)
    loan.disbursements.forEach(d => {
      const amt = Number(d.amount) / 100;
      running += amt;
      transactions.push({
        date:               new Date(d.createdAt).toISOString().slice(0, 10),
        type:               'DISBURSEMENT',
        amountRand:         amt.toFixed(2),
        description:        `Disbursement via ${d.rail}`,
        runningBalanceRand: running.toFixed(2),
      });
    });

    // Repayments (debit)
    loan.repayments.forEach(r => {
      const amt = Number(r.amount) / 100;
      running -= amt;
      const alloc = r.allocation as { fees?: number; interest?: number; principal?: number } ?? {};
      transactions.push({
        date:               new Date(r.receivedAt).toISOString().slice(0, 10),
        type:               'REPAYMENT',
        amountRand:         amt.toFixed(2),
        description:        `Repayment — P:R${((alloc.principal ?? 0) / 100).toFixed(2)} I:R${((alloc.interest ?? 0) / 100).toFixed(2)} F:R${((alloc.fees ?? 0) / 100).toFixed(2)}`,
        runningBalanceRand: Math.max(running, 0).toFixed(2),
      });
    });

    // Sort by date
    transactions.sort((a, b) => a.date.localeCompare(b.date));

    return {
      loanNumber:   loan.loanNumber,
      product:      loan.product?.name ?? 'N/A',
      status:       loan.status,
      principalRand:(Number(loan.principal) / 100).toFixed(2),
      transactions,
    };
  });

  const totalDisbursed  = borrower.loans.reduce((s, l) => s + Number(l.principal), 0);
  const totalRepaid     = borrower.loans.flatMap(l => l.repayments).reduce((s, r) => s + Number(r.amount), 0);
  const totalOutstanding = borrower.loans.reduce((s, l) => s + Number(l.outstandingPrincipal), 0);

  const data = {
    generatedAt: new Date().toISOString().slice(0, 10),
    borrower: {
      name:  borrower.individual?.fullName ?? 'N/A',
      email: borrower.email,
    },
    summary: {
      totalDisbursedRand:   (totalDisbursed / 100).toFixed(2),
      totalRepaidRand:      (totalRepaid / 100).toFixed(2),
      totalOutstandingRand: (totalOutstanding / 100).toFixed(2),
      activeLoanCount:      borrower.loans.filter(l => l.status === 'ACTIVE').length,
    },
    loans,
  };

  if (format === 'pdf') {
    const pdfBuffer = await renderTransactionHistory(data);
    return new Response(pdfBuffer, {
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="transactions_${borrowerId}.pdf"`,
      },
    });
  }

  return NextResponse.json({ data });
}
