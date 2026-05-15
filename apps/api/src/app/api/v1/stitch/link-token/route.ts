/**
 * POST /api/v1/stitch/link-token
 *
 * Returns a mock Stitch link token for bank account linking flow.
 * Replace mock with real Stitch OAuth when credentials are provisioned.
 *
 * Patterns applied:
 *   1. Early return — missing borrowerId
 *   6. to() helper
 *   7. Property shorthand
 */

import { NextRequest, NextResponse } from 'next/server';
import { createLinkToken } from '@capstack/integrations';

async function to<T>(p: Promise<T>): Promise<[Error, null] | [null, T]> {
  try {
    return [null, await p];
  } catch (err) {
    return [err instanceof Error ? err : new Error(String(err)), null];
  }
}

export async function POST(req: NextRequest) {
  const [parseErr, body] = await to<{ borrowerId?: string }>(req.json());
  if (parseErr) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

  // Pattern 3 — nullish coalescing
  const borrowerId = body?.borrowerId ?? 'anonymous';

  const [err, token] = await to(createLinkToken(borrowerId));
  if (err) return NextResponse.json({ error: 'Failed to create link token' }, { status: 500 });

  // Pattern 7 — shorthand
  return NextResponse.json({ token });
}
