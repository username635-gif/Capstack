/**
 * POST /api/v1/auth/partner
 *
 * Partner authentication — validates the raw API key by hashing it and
 * comparing against Partner.apiKeyHash.
 *
 * PRODUCTION: Replace with Clerk Organizations or OAuth.
 * The session shape returned here is identical to what a real auth provider
 * would return, making the swap a one-file change.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@capstack/db';
import { hashApiKey } from '@/lib/auth/api-key';

async function to<T>(p: Promise<T>): Promise<[Error, null] | [null, T]> {
  try { return [null, await p]; }
  catch (err) { return [err instanceof Error ? err : new Error(String(err)), null]; }
}

export async function POST(req: NextRequest) {
  const [parseErr, body] = await to<{ apiKey: string }>(req.json());
  if (parseErr) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

  const { apiKey } = body ?? {};
  if (!apiKey) return NextResponse.json({ error: 'apiKey is required' }, { status: 400 });

  const hashed = hashApiKey(apiKey);

  const [err, partner] = await to(
    prisma.partner.findUnique({ where: { apiKeyHash: hashed } }),
  );
  if (err)      return NextResponse.json({ error: err.message }, { status: 500 });
  if (!partner) return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });

  return NextResponse.json({
    id:       partner.id,
    name:     partner.name,
    slug:     partner.slug,
    lenderId: partner.lenderId,
    type:     'partner',
  });
}
