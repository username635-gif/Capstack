/**
 * GET /api/v1/products
 *
 * Returns active loan products available for origination.
 * Filters by lenderId and isActive flag.
 *
 * Patterns applied:
 *   1. Early return — DB error
 *   5. Array methods — map BigInt → Number for JSON serialisation
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
  const lenderId = searchParams.get('lenderId') ?? undefined;
  const active   = searchParams.get('active') !== 'false';

  const [err, products] = await to(
    prisma.loanProduct.findMany({
      where:   { ...(lenderId && { lenderId }), isActive: active },
      orderBy: { createdAt: 'desc' },
    }),
  );
  if (err) return NextResponse.json({ error: err.message }, { status: 500 });

  const data = products!.map(p => ({
    ...p,
    minAmount:      Number(p.minAmount),
    maxAmount:      Number(p.maxAmount),
    fixedFeeAmount: p.fixedFeeAmount ? Number(p.fixedFeeAmount) : null,
  }));

  return NextResponse.json({ data, count: data.length });
}
