/**
 * POST /api/webhooks/payfast
 *
 * Handles PayFast ITN (Instant Transaction Notification) webhooks.
 * Verifies the HMAC signature, then records the repayment and
 * decrements the loan's outstanding principal.
 *
 * Patterns applied:
 *   1. Early return — invalid signature, non-COMPLETE status
 *   3. Nullish coalescing — safe defaults for params
 *   4. Destructuring — form data fields
 *   6. to() helper
 *   7. Property shorthand
 */

import { NextRequest, NextResponse } from 'next/server';
import { payfast } from '@/lib/payfast';
import { prisma } from '@capstack/db';

async function to<T>(p: Promise<T>): Promise<[Error, null] | [null, T]> {
  try {
    return [null, await p];
  } catch (err) {
    return [err instanceof Error ? err : new Error(String(err)), null];
  }
}

export async function POST(req: NextRequest) {
  const [parseErr, formData] = await to(req.formData());
  if (parseErr) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const params = Object.fromEntries(formData!.entries()) as Record<string, string>;

  // Pattern 1 — early return on invalid ITN signature
  if (!payfast.itn.verify(params)) {
    return NextResponse.json({ error: 'Invalid ITN signature' }, { status: 400 });
  }

  // Pattern 4 — destructure with nullish coalescing defaults (pattern 3)
  const {
    pf_payment_id  = '',
    amount         = '0',
    m_payment_id   = '',
    payment_status = '',
  } = params;

  // Pattern 1 — only process completed payments
  if (payment_status !== 'COMPLETE') {
    return NextResponse.json({ received: true });
  }

  const amountCents = BigInt(Math.round(parseFloat(amount) * 100));
  const loanId      = m_payment_id;

  const [dbErr] = await to(
    prisma.$transaction([
      prisma.loanRepayment.create({
        data: {
          loanId,
          amount:      amountCents,
          receivedAt:  new Date(),
          rail:        'PAYFAST',
          externalRef: pf_payment_id,
          allocation: { fees: 0, interest: 0, principal: Number(amountCents) },
        },
      }),
      prisma.loan.update({
        where: { id: loanId },
        data:  { outstandingPrincipal: { decrement: amountCents } },
      }),
    ]),
  );

  if (dbErr) {
    console.error('[payfast-webhook] DB update failed:', dbErr);
    return NextResponse.json({ error: 'Failed to record repayment' }, { status: 500 });
  }

  const received = true;
  // Pattern 7 — shorthand
  return NextResponse.json({ received });
}
