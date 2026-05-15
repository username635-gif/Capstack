/**
 * GET /api/v1/collections
 *
 * Returns loans in arrears (daysPastDue ≥ minDpd), sorted from most to least
 * overdue. Used by the Ops Collections worklist page.
 *
 * Query params:
 *   minDpd   — minimum days past due to include (default 1)
 *   limit    — max results, capped at 200
 *   offset   — pagination offset
 *
 * Patterns applied:
 *   1. Early return — DB error
 *   3. Nullish coalescing — pagination defaults
 *   5. Array methods — map BigInt → Number
 *   7. Property shorthand
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@capstack/db';

async function to<T>(p: Promise<T>): Promise<[Error, null] | [null, T]> {
  try { return [null, await p]; }
  catch (err) { return [err instanceof Error ? err : new Error(String(err)), null]; }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const minDpd = Number(searchParams.get('minDpd') ?? 1);
  const take   = Math.min(Number(searchParams.get('limit') ?? 50), 200);
  const skip   = Number(searchParams.get('offset') ?? 0);

  const [err, loans] = await to(
    prisma.loan.findMany({
      where: {
        daysPastDue: { gte: minDpd },
        status:      { in: ['ACTIVE', 'DEFAULTED'] },
      },
      include: {
        borrower:    { include: { individual: true, business: true } },
        product:     true,
        collections: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { daysPastDue: 'desc' },
      take,
      skip,
    }),
  );
  if (err) return NextResponse.json({ error: err.message }, { status: 500 });

  const data = loans!.map(l => ({
    ...l,
    principal:            Number(l.principal),
    outstandingPrincipal: Number(l.outstandingPrincipal),
    outstandingInterest:  Number(l.outstandingInterest),
    outstandingFees:      Number(l.outstandingFees),
  }));

  return NextResponse.json({ data, count: data.length });
}
