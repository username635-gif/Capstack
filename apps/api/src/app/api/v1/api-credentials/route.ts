/**
 * GET  /api/v1/api-credentials   — list active credentials for a partner
 * POST /api/v1/api-credentials   — generate a new API key pair
 *
 * SECURITY:
 *   Raw secrets are shown ONCE on creation and NEVER stored in plaintext.
 *   Only the SHA-256 hash of the secret is persisted (hashedSecret field).
 *   The keyId is public (used for identification); the secret is private
 *   (used for authentication).
 *
 * Patterns applied:
 *   1. Early return — missing partnerId, DB errors
 *   5. Array methods — map to strip hashedSecret from list response
 *   7. Property shorthand
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@capstack/db';
import { randomBytes } from 'crypto';
import { hashApiKey } from '@/lib/auth/api-key';

async function to<T>(p: Promise<T>): Promise<[Error, null] | [null, T]> {
  try { return [null, await p]; }
  catch (err) { return [err instanceof Error ? err : new Error(String(err)), null]; }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const partnerId = searchParams.get('partnerId');
  if (!partnerId) return NextResponse.json({ error: 'partnerId is required' }, { status: 400 });

  const [err, creds] = await to(
    prisma.apiCredential.findMany({
      where:   { partnerId, isActive: true },
      orderBy: { createdAt: 'desc' },
    }),
  );
  if (err) return NextResponse.json({ error: err.message }, { status: 500 });

  // Strip hashedSecret — never expose raw or hashed secrets in list responses
  const data = creds!.map(({ hashedSecret: _h, ...c }) => c);
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const [parseErr, body] = await to<{ partnerId: string; scopes?: string[] }>(req.json());
  if (parseErr) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

  const { partnerId, scopes = ['loans:read', 'applications:write'] } = body ?? {};
  if (!partnerId) return NextResponse.json({ error: 'partnerId is required' }, { status: 400 });

  // Generate key pair — keyId is public, rawSecret is shown once and discarded
  const keyId      = `pk_live_${randomBytes(8).toString('hex')}`;
  const rawSecret  = `sk_live_${randomBytes(16).toString('hex')}`;
  const hashedSecret = hashApiKey(rawSecret);

  const [err, cred] = await to(
    prisma.apiCredential.create({
      data: { partnerId, keyId, hashedSecret, scopes },
    }),
  );
  if (err) return NextResponse.json({ error: err.message }, { status: 500 });

  return NextResponse.json(
    {
      id:      cred!.id,
      keyId,
      secret:  rawSecret,   // SHOWN ONCE — client must store this securely
      scopes,
      warning: 'Copy this secret now. It will not be shown again.',
    },
    { status: 201 },
  );
}
