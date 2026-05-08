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
import { inngest } from '@/lib/inngest';

const IDEMPOTENCY_TTL = 60 * 60 * 24; // 24 hours — matches typical session length

// Body shape for loan application requests
type ApplicationBody = {
  borrowerId: string;
  productId: string;
  amountRequested: number;
  termDaysRequested: number;
  purpose?: string;
  channel?: string;
  externalRef?: string;
};

/**
 * Pattern 6 — async to() helper.
 * Wraps any Promise in a [error, result] tuple so route handlers can handle
 * errors as values instead of wrapping every async call in try/catch.
 */
async function to<T>(p: Promise<T>): Promise<[Error, null] | [null, T]> {
  try {
    return [null, await p];
  } catch (err) {
    return [err instanceof Error ? err : new Error(String(err)), null];
  }
}

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

  // Pattern 6 — to(): body parse error becomes a value, not a thrown exception
  const [parseErr, body] = await to(req.json() as Promise<ApplicationBody>);
  if (parseErr) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

  // Pattern 4 — destructuring with default values: removes ?? noise in the data object below
  // Pattern 3 — nullish coalescing defaults declared here instead of inline in the object
  const {
    borrowerId,
    productId,
    amountRequested: requestedAmount, // renamed to free up 'amountRequested' for shorthand later
    termDaysRequested,
    purpose = null,
    channel = 'partner_api',
    externalRef = null,
  } = body!;

  // Pattern 1 — early return: validate required fields before touching the DB
  if (!borrowerId || !productId || !requestedAmount || !termDaysRequested) {
    return NextResponse.json(
      { error: 'Missing required fields: borrowerId, productId, amountRequested, termDaysRequested' },
      { status: 422 }
    );
  }

  // Lazy import prisma so Next.js edge doesn't complain
  const { prisma } = await import('@capstack/db');

  // Pattern 6 — to(): DB errors become values, no nested try/catch needed
  const [dbErr, application] = await to(
    prisma.application.create({
      data: {
        borrowerId,
        productId,
        amountRequested: BigInt(requestedAmount),
        termDaysRequested,
        purpose,      // Pattern 7 — shorthand (default already set at destructuring)
        channel,      // Pattern 7 — shorthand
        externalRef,  // Pattern 7 — shorthand
        status: 'SUBMITTED',
      },
    })
  );
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 422 });

  // Pattern 7 — property shorthand: name the transformed value to match the key name
  const amountRequested = Number(application!.amountRequested);
  const responseBody = { ...application!, amountRequested };

  // Cache the response for idempotency
  if (idempotencyKey) {
    await redis.set(`idempotency:${idempotencyKey}`, responseBody, { ex: IDEMPOTENCY_TTL });
  }

  // Fire underwriting event (non-blocking — workers service picks this up)
  await inngest.send({ name: 'application/created', data: { applicationId: application!.id } }).catch(() => {
    // Fail silently — event will be retried or triggered manually if Inngest isn't running
  });

  return NextResponse.json(responseBody, { status: 201 });
}

export async function GET(req: NextRequest) {
  const { prisma } = await import('@capstack/db');
  const { searchParams } = new URL(req.url);
  const status    = searchParams.get('status') ?? undefined;
  const borrowerId = searchParams.get('borrowerId') ?? undefined;
  const take      = Math.min(Number(searchParams.get('limit') ?? 20), 100);
  const skip      = Number(searchParams.get('offset') ?? 0);

  const [err, applications] = await to(
    prisma.application.findMany({
      where: { ...(status && { status: status as import('@capstack/db').ApplicationStatus }), ...(borrowerId && { borrowerId }) },
      include: { borrower: { include: { individual: true, business: true } }, product: true, decisions: { orderBy: { createdAt: 'desc' }, take: 1 } },
      orderBy: { submittedAt: 'desc' },
      take,
      skip,
    }),
  );
  if (err) return NextResponse.json({ error: err.message }, { status: 500 });

  const data = applications!.map(a => ({
    ...a,
    amountRequested: Number(a.amountRequested),
    latestDecision: a.decisions[0] ? {
      ...a.decisions[0],
      approvedAmount: a.decisions[0].approvedAmount ? Number(a.decisions[0].approvedAmount) : null,
    } : null,
  }));
  return NextResponse.json({ data, count: data.length });
}
