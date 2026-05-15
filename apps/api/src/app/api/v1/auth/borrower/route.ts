/**
 * POST /api/v1/auth/borrower
 *
 * Borrower authentication — looks up by email.
 *
 * PRODUCTION: Replace with Clerk.
 *   const { userId } = getAuth(req);
 *   const borrower = await prisma.borrower.findFirst({ where: { clerkId: userId } });
 *
 * Returns 401 if no borrower account matches. The sign-up page calls
 * POST /api/v1/borrowers first to create the account, then this endpoint.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@capstack/db';

const DEMO_MODE = !process.env.DATABASE_URL;

async function to<T>(p: Promise<T>): Promise<[Error, null] | [null, T]> {
  try { return [null, await p]; }
  catch (err) { return [err instanceof Error ? err : new Error(String(err)), null]; }
}

export async function POST(req: NextRequest) {
  const [parseErr, body] = await to<{ email: string }>(req.json());
  if (parseErr) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

  const { email } = body ?? {};
  if (!email) return NextResponse.json({ error: 'email is required' }, { status: 400 });

  // Demo mode — return a stub session so the UI can proceed without a real DB
  if (DEMO_MODE) {
    return NextResponse.json({
      id:    `demo_${Buffer.from(email).toString('base64').replace(/[^a-z0-9]/gi, '').slice(0, 12)}`,
      email,
      name:  email.split('@')[0],
      type:  'borrower',
    });
  }

  const [err, borrower] = await to(
    prisma.borrower.findFirst({
      where:   { email },
      include: {
        individual: { select: { fullName: true } },
        business:   { select: { legalName: true } },
      },
    }),
  );
  if (err)      return NextResponse.json({ error: err.message }, { status: 500 });
  if (!borrower) return NextResponse.json({ error: 'No account found. Please sign up first.' }, { status: 401 });

  const name = borrower.individual?.fullName ?? borrower.business?.legalName ?? borrower.email;

  return NextResponse.json({
    id:   borrower.id,
    email: borrower.email,
    name,
    type: 'borrower',
  });
}
