/**
 * POST /api/v1/loans/disburse
 *
 * Initiates disbursement for an approved loan via PayFast (with Stitch fallback).
 *
 * Patterns applied:
 *   1. Early return — loan not found / wrong status
 *   4. Destructuring — request body
 *   6. to() helper
 *   7. Property shorthand
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@capstack/db';
import { disburseWithFallback } from '@/lib/disbursement';

async function to<T>(p: Promise<T>): Promise<[Error, null] | [null, T]> {
  try {
    return [null, await p];
  } catch (err) {
    return [err instanceof Error ? err : new Error(String(err)), null];
  }
}

export async function POST(req: NextRequest) {
  const [parseErr, body] = await to<{
    loanId: string;
    amount: number;
    bankAccount: { bank: string; number: string; name: string; branchCode: string };
  }>(req.json());

  if (parseErr) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

  // Pattern 4 — destructure
  const { loanId, amount, bankAccount } = body!;

  if (!loanId || !amount || !bankAccount) {
    return NextResponse.json({ error: 'Missing loanId, amount or bankAccount' }, { status: 400 });
  }

  // Pattern 6 — to() for DB call
  const [loanErr, loan] = await to(prisma.loan.findUnique({ where: { id: loanId } }));

  // Pattern 1 — early returns
  if (loanErr) return NextResponse.json({ error: 'DB error' }, { status: 500 });
  if (!loan)   return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
  if (loan.status !== 'PENDING_DISBURSEMENT') {
    return NextResponse.json({ error: 'Loan not ready for disbursement' }, { status: 400 });
  }

  const [disbErr, payout] = await to(
    disburseWithFallback(loanId, amount / 100, {
      bank:           bankAccount.bank,
      account_number: bankAccount.number,
      account_name:   bankAccount.name,
      branch_code:    bankAccount.branchCode,
    }),
  );

  if (disbErr) {
    console.error('[disburse] payout failed:', disbErr);
    return NextResponse.json({ error: 'Disbursement failed' }, { status: 502 });
  }

  // Persist disbursement record + update loan status atomically
  await prisma.$transaction([
    prisma.disbursement.create({
      data: {
        loanId,
        amount: BigInt(amount),
        rail: 'PAYFAST',
        externalRef: payout!.id,
        status: 'INITIATED',
        initiatedAt: new Date(),
      },
    }),
    prisma.loan.update({
      where: { id: loanId },
      data: { status: 'ACTIVE', disbursedAt: new Date() },
    }),
  ]);

  const success = true;
  // Pattern 7 — shorthand
  return NextResponse.json({ success, payoutId: payout!.id });
}
