import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';

const IDEMPOTENCY_TTL = 60 * 60 * 24; // 24 hours

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
