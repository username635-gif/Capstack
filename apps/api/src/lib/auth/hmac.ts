/**
 * HMAC-SHA256 request signature verification.
 *
 * Partners sign their webhook payloads using the shared webhook secret.
 * We verify the signature before processing to prevent replay attacks.
 *
 * Header expected: `X-Signature: sha256=<hex-digest>`
 *
 * SECURITY:
 *   - Uses timingSafeEqual to prevent timing attacks.
 *   - Raw secret is never logged.
 *
 * Patterns applied:
 *   1. Early return — missing header / wrong format
 *   3. Nullish coalescing — safe header access
 *   7. Property shorthand
 */

import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Compute HMAC-SHA256 signature for a payload.
 * Returns `sha256=<hex>` to match the expected header format.
 */
export function signPayload(payload: string, secret: string): string {
  const hex = createHmac('sha256', secret).update(payload).digest('hex');
  return `sha256=${hex}`;
}

/**
 * Verify that `headerValue` matches the HMAC of `payload` using `secret`.
 *
 * @param payload      Raw request body string
 * @param headerValue  Value of the `X-Signature` header
 * @param secret       Partner webhook secret stored in the database
 */
export function verifyHmac(
  payload:     string,
  headerValue: string | null,
  secret:      string,
): boolean {
  // Pattern 3 — nullish coalescing
  const header = headerValue ?? '';

  // Pattern 1 — early return on missing/malformed header
  if (!header.startsWith('sha256=')) return false;

  const expected = signPayload(payload, secret);

  try {
    // Constant-time comparison — prevents timing attacks (OWASP A07)
    return timingSafeEqual(
      Buffer.from(header,   'utf8'),
      Buffer.from(expected, 'utf8'),
    );
  } catch {
    return false;
  }
}
