/**
 * POST /api/v1/kyc/webhook
 *
 * Receives Onfido check completion webhooks and updates the KycCheck record.
 * In production: verify the X-SHA2-Signature header before processing.
 *
 * Patterns applied:
 *   1. Early return — unknown events, missing data
 *   3. Nullish coalescing
 *   4. Destructuring
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

interface OnfidoWebhookPayload {
  payload: {
    action: string;
    object: {
      id: string;
      status: string;
      result?: string;
    };
  };
}

// Map Onfido result codes to our KycStatus enum
function mapStatus(result?: string): string {
  // Pattern 2 — ternary
  return result === 'clear' ? 'PASSED' : result === 'consider' ? 'MANUAL_REVIEW' : 'FAILED';
}

export async function POST(req: NextRequest) {
  const [parseErr, body] = await to<OnfidoWebhookPayload>(req.json());
  if (parseErr) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

  // Pattern 4 — destructure
  const { action, object: { id, result } } = body!.payload;

  // Pattern 1 — early return on unhandled action
  if (action !== 'check.completed') {
    return NextResponse.json({ received: true });
  }

  const status = mapStatus(result);

  const [dbErr] = await to(
    prisma.kycCheck.updateMany({
      where: { externalId: id },
      data:  { status: status as 'PASSED' | 'MANUAL_REVIEW' | 'FAILED', completedAt: new Date() },
    }),
  );

  if (dbErr) {
    console.error('[kyc-webhook] DB update failed:', dbErr);
    return NextResponse.json({ error: 'DB error' }, { status: 500 });
  }

  const received = true;
  // Pattern 7 — shorthand
  return NextResponse.json({ received });
}
