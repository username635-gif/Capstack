/**
 * POST /api/webhooks/clerk
 *
 * Syncs Clerk `user.created` events to the Borrower table.
 * Uses svix to verify the webhook signature before processing.
 *
 * NOTE: The Borrower schema does not have a clerkId field, so we use
 * email as the lookup key — creating only if no matching email exists.
 *
 * Patterns applied:
 *   1. Early return — bail on bad signature or unknown event type
 *   3. Optional chaining + nullish coalescing — safe email/phone access
 *   6. to() helper — surface errors as values
 *   7. Property shorthand
 */

import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { prisma } from '@capstack/db';

// Minimal Clerk webhook event shape (avoids requiring @clerk/nextjs)
interface ClerkEmailAddress { email_address: string }
interface ClerkPhoneNumber  { phone_number: string  }
interface ClerkUserCreatedData {
  id: string;
  email_addresses: ClerkEmailAddress[];
  phone_numbers: ClerkPhoneNumber[];
}
type ClerkWebhookEvent =
  | { type: 'user.created'; data: ClerkUserCreatedData }
  | { type: string; data: unknown };

async function to<T>(p: Promise<T>): Promise<[Error, null] | [null, T]> {
  try {
    return [null, await p];
  } catch (err) {
    return [err instanceof Error ? err : new Error(String(err)), null];
  }
}

export async function POST(req: Request) {
  const payload = await req.text();
  const hdrs    = await headers();

  // Pattern 3 — optional chaining for header access
  const svixId        = hdrs.get('svix-id')        ?? '';
  const svixTimestamp = hdrs.get('svix-timestamp')  ?? '';
  const svixSignature = hdrs.get('svix-signature')  ?? '';

  // Pattern 1 — early return on missing svix headers
  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response('Missing svix headers', { status: 400 });
  }

  const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET ?? '');
  const [verifyErr, evt] = await to(
    Promise.resolve(
      wh.verify(payload, {
        'svix-id':        svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      }) as ClerkWebhookEvent,
    ),
  );

  // Pattern 1 — early return on invalid signature
  if (verifyErr) {
    return new Response('Invalid webhook signature', { status: 401 });
  }

  // Pattern 1 — early return for unhandled event types
  if (evt!.type !== 'user.created') {
    return new Response('OK', { status: 200 });
  }

  const { id, email_addresses, phone_numbers } = (evt as { type: 'user.created'; data: ClerkUserCreatedData }).data;

  // Pattern 3 — nullish coalescing for optional nested fields
  const email = email_addresses[0]?.email_address ?? '';
  const phone = phone_numbers[0]?.phone_number    ?? '';

  // Only create if no borrower with this email yet (schema has no clerkId)
  const existing = await prisma.borrower.findFirst({ where: { email } });

  if (!existing) {
    const [createErr] = await to(
      prisma.borrower.create({
        // Pattern 7 — property shorthand
        data: { type: 'INDIVIDUAL', email, phone },
      }),
    );

    if (createErr) {
      console.error('[clerk-webhook] create borrower failed:', createErr, { id });
    }
  }

  return new Response('OK', { status: 200 });
}
