/**
 * GET  /api/v1/kyc-checks   — paginated KYC queue with optional status filter
 * PATCH /api/v1/kyc-checks  — update a check's status (approve / fail / refer)
 *
 * Used by the Ops KYC review page to list and action KYC checks.
 *
 * Patterns applied:
 *   1. Early return — missing params, DB errors
 *   3. Nullish coalescing — safe defaults for pagination
 *   5. Array methods — map for response shaping
 *   7. Property shorthand
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@capstack/db';
import type { KycStatus } from '@capstack/db';

async function to<T>(p: Promise<T>): Promise<[Error, null] | [null, T]> {
  try { return [null, await p]; }
  catch (err) { return [err instanceof Error ? err : new Error(String(err)), null]; }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status     = searchParams.get('status') as KycStatus | null;
  const borrowerId = searchParams.get('borrowerId') ?? undefined;
  const take = Math.min(Number(searchParams.get('limit') ?? 50), 200);
  const skip = Number(searchParams.get('offset') ?? 0);

  const [err, checks] = await to(
    prisma.kycCheck.findMany({
      where: {
        ...(status     && { status }),
        ...(borrowerId && { borrowerId }),
      },
      include: { borrower: { include: { individual: true, business: true } } },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    }),
  );
  if (err) return NextResponse.json({ error: err.message }, { status: 500 });

  return NextResponse.json({ data: checks, count: checks!.length });
}

export async function PATCH(req: NextRequest) {
  const [parseErr, body] = await to<{ id: string; status: KycStatus; outcome?: string }>(req.json());
  if (parseErr) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

  const { id, status: newStatus, outcome } = body ?? {};
  if (!id || !newStatus) {
    return NextResponse.json({ error: 'id and status are required' }, { status: 400 });
  }

  const [err, updated] = await to(
    prisma.kycCheck.update({
      where: { id },
      data:  {
        status:      newStatus,
        outcome,
        completedAt: ['PASSED', 'FAILED'].includes(newStatus) ? new Date() : undefined,
      },
    }),
  );
  if (err) return NextResponse.json({ error: err.message }, { status: 500 });

  return NextResponse.json(updated);
}
