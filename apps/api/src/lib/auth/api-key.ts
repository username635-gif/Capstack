/**
 * API key authentication helper.
 *
 * Hashes the incoming key with SHA-256 and checks it against the
 * ApiCredential table. This prevents storing raw keys in the database.
 *
 * SECURITY: Never log the raw key. Compare only hashed values.
 *
 * Patterns applied:
 *   1. Early return — empty key
 *   3. Nullish coalescing — safe DB result access
 *   6. to() helper
 *   7. Property shorthand
 */

import { createHash } from 'crypto';
import { prisma } from '@capstack/db';

async function to<T>(p: Promise<T>): Promise<[Error, null] | [null, T]> {
  try {
    return [null, await p];
  } catch (err) {
    return [err instanceof Error ? err : new Error(String(err)), null];
  }
}

/**
 * SHA-256 hex digest of a raw API key.
 *
 * Raw keys are NEVER stored in the database — only their hash is stored.
 * This means a database breach does not expose usable API keys.
 * When a partner is issued a key, show it ONCE then discard the raw value.
 */
export function hashApiKey(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

/**
 * Returns true if the raw API key belongs to an active credential.
 *
 * @param raw  The raw key from the `x-api-key` request header
 */
export async function verifyApiKey(raw: string): Promise<boolean> {
  // Pattern 1 — early return on empty key
  if (!raw?.trim()) return false;

  const hashed = hashApiKey(raw);

  const [err, credential] = await to(
    prisma.apiCredential.findFirst({
      where: {
        hashedSecret: hashed,
        isActive:     true,
        // Pattern 3 — treat null expiresAt as never-expiring
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    }),
  );

  // Pattern 1 — early return on DB error (fail secure)
  if (err) {
    console.error('[api-key] DB lookup failed:', err);
    return false;
  }

  return !!credential;
}
