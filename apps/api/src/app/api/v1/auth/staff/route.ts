/**
 * POST /api/v1/auth/staff
 *
 * Staff authentication — looks up a Staff record by email and returns a
 * session payload. No password check in demo mode.
 *
 * PRODUCTION: Replace this handler with Clerk.
 *   import { getAuth } from '@clerk/nextjs/server';
 *   const { userId } = getAuth(req);
 *   const staff = await prisma.staff.findUnique({ where: { clerkId: userId } });
 *   Then return the same session shape below.
 *
 * This stub keeps the session shape identical to what Clerk would return,
 * so swapping the auth provider is a one-file change.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@capstack/db';

const DEMO_MODE = !process.env.DATABASE_URL;
const DEMO_EMAIL = 'ops@capstack.demo';

async function to<T>(p: Promise<T>): Promise<[Error, null] | [null, T]> {
  try { return [null, await p]; }
  catch (err) { return [err instanceof Error ? err : new Error(String(err)), null]; }
}

export async function POST(req: NextRequest) {
  const [parseErr, body] = await to<{ email: string }>(req.json());
  if (parseErr) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

  const { email } = body ?? {};
  if (!email) return NextResponse.json({ error: 'email is required' }, { status: 400 });

  // Demo mode — only the demo email works; no DB required
  if (DEMO_MODE) {
    if (email.toLowerCase() !== DEMO_EMAIL) {
      return NextResponse.json(
        { error: 'Demo access is restricted to the provisioned internal account.' },
        { status: 401 },
      );
    }
    return NextResponse.json({
      id:     'demo_staff_001',
      email:  DEMO_EMAIL,
      name:   'Demo Advisor',
      role:   'ADMIN',
      lender: { id: 'demo_lender_001', name: 'Capstack Demo' },
      type:   'staff',
    });
  }

  const [err, staff] = await to(
    prisma.staff.findUnique({
      where:   { email },
      include: { lender: { select: { id: true, name: true } } },
    }),
  );
  if (err)    return NextResponse.json({ error: err.message }, { status: 500 });
  if (!staff) return NextResponse.json({ error: 'No account found with that email' }, { status: 401 });

  return NextResponse.json({
    id:     staff.id,
    email:  staff.email,
    name:   staff.fullName,
    role:   staff.role,
    lender: { id: staff.lenderId, name: staff.lender.name },
    type:   'staff',
  });
}
