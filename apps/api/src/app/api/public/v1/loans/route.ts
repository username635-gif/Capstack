/**
 * GET /api/public/v1/loans
 *
 * Public partner-facing endpoint — returns the authenticated partner's loans.
 * Requires a valid API key in the `x-api-key` header.
 *
 * SANDBOX MODE:
 *   Partners can pass the header `x-capstack-sandbox: true` to switch into
 *   sandbox mode. In sandbox mode:
 *     - No real database reads or writes occur.
 *     - Deterministic mock loan data is returned so partners can build and
 *       test their integration without needing live loan records.
 *     - Sandbox API keys start with `sk_test_` (live keys start with `sk_live_`).
 *     - Sandbox responses include the header `X-Capstack-Sandbox: true`.
 *
 *   This mirrors how Stripe and Stitch handle sandbox vs live environments,
 *   making it easy for partners to switch from test to prod by changing only
 *   the API key and removing the sandbox header.
 *
 * Patterns applied:
 *   1. Early return — missing / invalid API key, sandbox short-circuit
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

// ── Sandbox fixture data ───────────────────────────────────────────────────
// Returned deterministically when x-capstack-sandbox: true is present.
// Mirrors the exact shape of live loan records so integration code needs
// no changes when switching from sandbox to production.
const SANDBOX_LOANS = [
  {
    id:                   'ln_sandbox_001',
    loanNumber:           'LN-SANDBOX-00001',
    status:               'ACTIVE',
    principal:            '1500000',           // R15 000 in cents as string
    outstandingPrincipal: '900000',
    aprBps:               1800,
    startDate:            '2026-04-01T00:00:00.000Z',
    maturityDate:         '2026-09-30T00:00:00.000Z',
  },
  {
    id:                   'ln_sandbox_002',
    loanNumber:           'LN-SANDBOX-00002',
    status:               'PENDING_DISBURSEMENT',
    principal:            '5000000',
    outstandingPrincipal: '5000000',
    aprBps:               2400,
    startDate:            '2026-05-15T00:00:00.000Z',
    maturityDate:         '2026-11-14T00:00:00.000Z',
  },
];

export async function GET(req: NextRequest) {
  // Pattern 3 — nullish coalescing
  const rawKey    = req.headers.get('x-api-key') ?? '';
  const isSandbox = req.headers.get('x-capstack-sandbox') === 'true' ||
                    rawKey.startsWith('sk_test_');

  // Pattern 1 — early return on missing key
  if (!rawKey) {
    return NextResponse.json({ error: 'Missing x-api-key header' }, { status: 401 });
  }

  // Pattern 1 — sandbox short-circuit: return mock data without hitting the DB
  if (isSandbox) {
    return NextResponse.json(
      { data: SANDBOX_LOANS, sandbox: true },
      { headers: { 'X-Capstack-Sandbox': 'true' } },
    );
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
