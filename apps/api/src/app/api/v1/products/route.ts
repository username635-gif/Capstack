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

const DEMO_MODE = !process.env.DATABASE_URL;

// Demo loan products shown when no database is connected
const DEMO_PRODUCTS = [
  {
    id: 'demo_prod_personal',
    name: 'Personal Loan',
    type: 'PERSONAL',
    minAmount: 100000,      // R 1 000
    maxAmount: 5000000,     // R 50 000
    minTermDays: 30,
    maxTermDays: 365,
    defaultAprBps: 2400,    // 24% APR
    fixedFeeAmount: null,
    isActive: true,
    lenderId: 'demo',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'demo_prod_short',
    name: 'Short-Term Loan',
    type: 'SHORT_TERM',
    minAmount: 50000,       // R 500
    maxAmount: 1000000,     // R 10 000
    minTermDays: 7,
    maxTermDays: 90,
    defaultAprBps: 3600,    // 36% APR
    fixedFeeAmount: 5000,   // R 50 initiation fee
    isActive: true,
    lenderId: 'demo',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'demo_prod_business',
    name: 'Business Loan',
    type: 'BUSINESS',
    minAmount: 500000,      // R 5 000
    maxAmount: 25000000,    // R 250 000
    minTermDays: 90,
    maxTermDays: 730,
    defaultAprBps: 1800,    // 18% APR
    fixedFeeAmount: null,
    isActive: true,
    lenderId: 'demo',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

async function to<T>(p: Promise<T>): Promise<[Error, null] | [null, T]> {
  try { return [null, await p]; }
  catch (err) { return [err instanceof Error ? err : new Error(String(err)), null]; }
}

export async function GET(req: NextRequest) {
  if (DEMO_MODE) {
    return NextResponse.json({ data: DEMO_PRODUCTS, count: DEMO_PRODUCTS.length });
  }

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
