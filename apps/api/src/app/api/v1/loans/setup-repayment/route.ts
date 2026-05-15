/**
 * POST /api/v1/loans/setup-repayment
 *
 * Tokenises a card via PayFast for future recurring debit orders.
 * The token is stored in the CollectionEvent table for audit.
 * (Loan model has no metadata field, so we use CollectionEvent for storage.)
 *
 * Patterns applied:
 *   1. Early return — validate inputs, check loan exists
 *   4. Destructuring
 *   6. to() helper
 *   7. Property shorthand
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@capstack/db';
import { payfast } from '@/lib/payfast';

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
    cardDetails: { number: string; expiry: string; cvv: string; name: string };
  }>(req.json());

  if (parseErr) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

  // Pattern 4 — destructure
  const { loanId, cardDetails } = body!;

  if (!loanId || !cardDetails) {
    return NextResponse.json({ error: 'Missing loanId or cardDetails' }, { status: 400 });
  }

  // Pattern 1 — early return if loan missing
  const [loanErr, loan] = await to(prisma.loan.findUnique({ where: { id: loanId } }));
  if (loanErr) return NextResponse.json({ error: 'DB error' }, { status: 500 });
  if (!loan)   return NextResponse.json({ error: 'Loan not found' }, { status: 404 });

  const [tokenErr, result] = await to(
    payfast.tokenization.create({
      card_number: cardDetails.number,
      card_expiry: cardDetails.expiry,
      card_cvv:    cardDetails.cvv,
      name:        cardDetails.name,
    }),
  );

  if (tokenErr) {
    console.error('[setup-repayment] tokenisation failed:', tokenErr);
    return NextResponse.json({ error: 'Tokenisation failed' }, { status: 502 });
  }

  // Persist token reference in CollectionEvent (audit trail)
  await prisma.collectionEvent.create({
    data: {
      loanId,
      type: 'CARD_TOKENISED',
      channel: 'PAYFAST',
      payload: { payfastToken: result!.token },
    },
  });

  const success = true;
  // Pattern 7 — shorthand
  return NextResponse.json({ success });
}
