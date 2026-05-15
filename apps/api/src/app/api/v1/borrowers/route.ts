/**
 * POST /api/v1/borrowers
 *
 * Creates a new borrower (INDIVIDUAL or BUSINESS) with related sub-record.
 *
 * Patterns applied:
 *   1. Early return — validate immediately, skip nested blocks
 *   2. Ternary — conditional nested create spreads
 *   3. Optional chaining + nullish coalescing — phone ?? null
 *   4. Destructuring — body fields extracted at top
 *   6. to() helper — async error as value
 *   7. Property shorthand
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@capstack/db';

// DEMO MODE: when no database is configured, return stub responses so the
// UI flow can be demonstrated end-to-end without a real backend.
const DEMO_MODE = !process.env.DATABASE_URL;

async function to<T>(p: Promise<T>): Promise<[Error, null] | [null, T]> {
  try {
    return [null, await p];
  } catch (err) {
    return [err instanceof Error ? err : new Error(String(err)), null];
  }
}

type IndividualInput = {
  fullName: string;
  idNumber: string;
  dateOfBirth: string;
  monthlyIncome?: number;
  employmentStatus?: string;
};

type BusinessInput = {
  legalName: string;
  registrationNumber: string;
  monthlyTurnover?: number;
  industry?: string;
};

type BorrowerBody = {
  type: 'INDIVIDUAL' | 'BUSINESS';
  email: string;
  phone?: string;
  individual?: IndividualInput;
  business?: BusinessInput;
};

export async function GET(req: NextRequest) {
  const { prisma } = await import('@capstack/db');
  const { searchParams } = new URL(req.url);
  const take = Math.min(Number(searchParams.get('limit') ?? 20), 100);
  const skip = Number(searchParams.get('offset') ?? 0);
  const q    = searchParams.get('q');

  const [err, borrowers] = await to(
    prisma.borrower.findMany({
      where: q ? { OR: [{ email: { contains: q } }, { phone: { contains: q } }] } : undefined,
      include: { individual: true, business: true },
      orderBy: { updatedAt: 'desc' },
      take,
      skip,
    }),
  );
  if (err) return NextResponse.json({ error: err.message }, { status: 500 });

  const data = borrowers!.map(b => ({
    ...b,
    individual: b.individual ? { ...b.individual, monthlyIncome: b.individual.monthlyIncome ? Number(b.individual.monthlyIncome) : null } : null,
    business:   b.business   ? { ...b.business,   monthlyTurnover: b.business.monthlyTurnover ? Number(b.business.monthlyTurnover) : null } : null,
  }));
  return NextResponse.json({ data, count: data.length });
}

export async function POST(req: NextRequest) {
  const [parseErr, body] = await to<BorrowerBody>(req.json());

  // Pattern 1 — early return on bad JSON
  if (parseErr) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Pattern 4 — destructuring with defaults
  const { type, email, phone = '', individual, business } = body!;

  // Pattern 1 — early return on missing required fields
  if (!type || !email) {
    return NextResponse.json({ error: 'Missing required fields: type, email' }, { status: 400 });
  }

  if (type !== 'INDIVIDUAL' && type !== 'BUSINESS') {
    return NextResponse.json({ error: 'type must be INDIVIDUAL or BUSINESS' }, { status: 400 });
  }

  // Demo mode — no DB required
  if (DEMO_MODE) {
    const now = new Date().toISOString();
    const id  = `demo_${Math.random().toString(36).slice(2, 10)}`;
    return NextResponse.json({
      id,
      type,
      email,
      phone: phone ?? '',
      individual: (type === 'INDIVIDUAL' && individual) ? {
        id: `demo_ind_${Math.random().toString(36).slice(2, 10)}`,
        borrowerId: id,
        fullName:         individual.fullName,
        idNumber:         individual.idNumber,
        dateOfBirth:      individual.dateOfBirth,
        monthlyIncome:    individual.monthlyIncome ?? null,
        employmentStatus: individual.employmentStatus ?? null,
        residentialAddress: {},
        createdAt: now,
        updatedAt: now,
      } : null,
      business: null,
      createdAt: now,
      updatedAt: now,
    }, { status: 201 });
  }

  const [err, borrower] = await to(
    prisma.borrower.create({
      data: {
        type,
        email,
        // Pattern 3 — nullish coalescing
        phone: phone ?? '',
        // Pattern 2 — ternary for conditional nested create
        ...(type === 'INDIVIDUAL' && individual && {
          individual: {
            create: {
              fullName: individual.fullName,
              idNumber: individual.idNumber,
              dateOfBirth: new Date(individual.dateOfBirth),
              monthlyIncome: BigInt(individual.monthlyIncome ?? 0),
              employmentStatus: individual.employmentStatus ?? null,
              residentialAddress: {},
            },
          },
        }),
        ...(type === 'BUSINESS' && business && {
          business: {
            create: {
              legalName: business.legalName,
              registrationNumber: business.registrationNumber,
              monthlyTurnover: BigInt(business.monthlyTurnover ?? 0),
              industry: business.industry ?? null,
              registeredAddress: {},
              ownershipStructure: {},
            },
          },
        }),
      },
      include: { individual: true, business: true },
    }),
  );

  // Pattern 1 — early return on DB error
  if (err) {
    console.error('[borrowers] create failed:', err);
    return NextResponse.json({ error: 'Failed to create borrower' }, { status: 500 });
  }

  return NextResponse.json(borrower, { status: 201 });
}
