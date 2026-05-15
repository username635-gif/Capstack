/**
 * POST /api/v1/stitch/webhook  (mock)
 *
 * Receives Stitch open banking webhook events and persists
 * transaction data to the BankTransaction table.
 *
 * Patterns applied:
 *   1. Early return — unknown event type
 *   4. Destructuring
 *   5. Array methods — map for bulk inserts
 *   6. to() helper
 *   7. Property shorthand
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@capstack/db';

async function to<T>(p: Promise<T>): Promise<[Error, null] | [null, T]> {
  try {
    return [null, await p];
  } catch (err) {
    return [err instanceof Error ? err : new Error(String(err)), null];
  }
}

interface StitchWebhookEvent {
  event: string;
  accountId: string;
  transactions?: Array<{
    id: string;
    date: string;
    amount: number;
    description: string;
    type: 'credit' | 'debit';
  }>;
}

export async function POST(req: NextRequest) {
  const [parseErr, body] = await to<StitchWebhookEvent>(req.json());
  if (parseErr) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

  // Pattern 4 — destructure
  const { event, accountId, transactions = [] } = body!;

  // Pattern 1 — early return on unhandled event
  if (event !== 'transactions.updated') {
    return NextResponse.json({ received: true });
  }

  // Pattern 5 — map for building createMany data
  const data = transactions.map(({ id, date, amount, description, type }) => ({
    accountId,
    externalId: id,
    date:        new Date(date),
    amount:      BigInt(Math.abs(Math.round(amount * 100))),
    description,
    type:        type.toUpperCase() as 'CREDIT' | 'DEBIT',
  }));

  const [dbErr] = await to(
    prisma.bankTransaction.createMany({ data, skipDuplicates: true }),
  );

  if (dbErr) {
    console.error('[stitch-webhook] DB error:', dbErr);
    return NextResponse.json({ error: 'Failed to store transactions' }, { status: 500 });
  }

  const received = true;
  // Pattern 7 — shorthand
  return NextResponse.json({ received });
}
