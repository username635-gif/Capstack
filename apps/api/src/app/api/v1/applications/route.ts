/**
 * POST /api/v1/applications
 *
 * Creates a new loan application for a borrower.
 *
 * IDEMPOTENCY:
 *   Clients should pass an `idempotency-key` header (UUID) with every request.
 *   If the same key is seen within 24 hours, the original response is returned
 *   from Redis cache without hitting the database again. This prevents duplicate
 *   applications if the client retries due to a network timeout.
 *
 *   Response headers:
 *     X-Idempotent: true   — request was a duplicate; response from cache
 *     (header absent)      — first-time request; application created
 *
 *   Status codes:
 *     201  Application created successfully
 *     200  Duplicate request detected; returning cached response
 *     400  Invalid or malformed JSON body
 *     422  Missing required fields OR database constraint violation
 *
 * APPLICATION STATUS FLOW:
 *   SUBMITTED → UNDER_REVIEW → APPROVED | DECLINED | REFER
 *   After approval: DISBURSED → ACTIVE → SETTLED | DEFAULTED
 *
 * NEXT STEPS (for developer implementing the full flow):
 *   1. Trigger a KYC check via @capstack/kyc immediately after creating the application
 *   2. Enqueue a credit scoring job in the Workers service
 *   3. Send a confirmation notification (email/SMS) to the borrower
 *   4. Emit an ApplicationEvent (type: APPLICATION_SUBMITTED) to the audit log
 *
 * BIGINT NOTE:
 *   amountRequested is stored as BigInt in Prisma (mapped to Postgres numeric).
 *   It must be converted to Number before serialising to JSON.
 */

import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';

const IDEMPOTENCY_TTL = 60 * 60 * 24; // 24 hours — matches typical session length

export async function POST(req: NextRequest) {
  const idempotencyKey = req.headers.get('idempotency-key');

  // Check idempotency cache first
  if (idempotencyKey) {
    const cached = await redis.get(`idempotency:${idempotencyKey}`);
    if (cached) {
      return NextResponse.json(cached, {
        status: 200,
        headers: { 'X-Idempotent': 'true' },
      });
    }
  }

  let body: {
    borrowerId: string;
    productId: string;
    amountRequested: number;
    termDaysRequested: number;
    purpose?: string;
    channel?: string;
    externalRef?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { borrowerId, productId, amountRequested, termDaysRequested, purpose, channel, externalRef } = body;

  if (!borrowerId || !productId || !amountRequested || !termDaysRequested) {
    return NextResponse.json(
      { error: 'Missing required fields: borrowerId, productId, amountRequested, termDaysRequested' },
      { status: 422 }
    );
  }

  // Lazy import prisma so Next.js edge doesn't complain
  const { prisma } = await import('@capstack/db');

  let application;
  try {
    application = await prisma.application.create({
      data: {
        borrowerId,
        productId,
        amountRequested: BigInt(amountRequested),
        termDaysRequested,
        purpose: purpose ?? null,
        channel: channel ?? 'partner_api',
        externalRef: externalRef ?? null,
        status: 'SUBMITTED',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Database error';
    return NextResponse.json({ error: message }, { status: 422 });
  }

  // Serialize BigInt for JSON
  const responseBody = {
    ...application,
    amountRequested: Number(application.amountRequested),
  };

  // Cache the response for idempotency
  if (idempotencyKey) {
    await redis.set(`idempotency:${idempotencyKey}`, responseBody, { ex: IDEMPOTENCY_TTL });
  }

  return NextResponse.json(responseBody, { status: 201 });
}
