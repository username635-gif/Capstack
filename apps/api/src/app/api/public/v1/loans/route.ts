/**
 * GET /api/public/v1/loans
 *
 * Public partner-facing endpoint — returns the authenticated partner's loans.
 * Requires a valid API key in the `x-api-key` header.
 *
 * Patterns applied:
 *   1. Early return — missing / invalid API key
 *   3. Nullish coalescing — safe header access
 *   5. Array methods — map for response shaping
 *   6. to() helper
 *   7. Property shorthand
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@capstack/db';
import { verifyApiKey, hashApiKey } from '@/lib/auth/api-key';

async function to<T>(p: Promise<T>): Promise<[Error, null] | [null, T]> {
  try {
    return [null, await p];
  } catch (err) {
    return [err instanceof Error ? err : new Error(String(err)), null];
  }
}

export async function GET(req: NextRequest) {
  // Pattern 3 — nullish coalescing
  const rawKey = req.headers.get('x-api-key') ?? '';

  // Pattern 1 — early return on missing key
  if (!rawKey) {
    return NextResponse.json({ error: 'Missing x-api-key header' }, { status: 401 });
  }

  const valid = await verifyApiKey(rawKey);
  if (!valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Identify the partner from the hashed key
  const [credErr, credential] = await to(
    prisma.apiCredential.findFirst({
      where: { hashedSecret: hashApiKey(rawKey), isActive: true },
      include: { partner: true },
    }),
  );

  if (credErr || !credential) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch loans belonging to this partner
  const [loansErr, loans] = await to(
    prisma.loan.findMany({
      where: { partnerId: credential.partner.id },
      select: {
        id:                  true,
        loanNumber:          true,
        status:              true,
        principal:           true,
        outstandingPrincipal: true,
        aprBps:              true,
        startDate:           true,
        maturityDate:        true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
  );

  if (loansErr) {
    return NextResponse.json({ error: 'DB error' }, { status: 500 });
  }

  // Pattern 5 — map to serialise BigInt fields
  const data = (loans ?? []).map(l => ({
    ...l,
    principal:            l.principal.toString(),
    outstandingPrincipal: l.outstandingPrincipal.toString(),
  }));

  // Pattern 7 — shorthand
  return NextResponse.json({ data });
}
