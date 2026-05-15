/**
 * POST /api/v1/kyc/initiate
 *
 * Initiates an Onfido identity verification check for a borrower.
 * Returns an SDK token that the front-end uses to launch the Onfido SDK.
 *
 * Patterns applied:
 *   1. Early return — borrower not found
 *   3. Optional chaining + nullish coalescing
 *   4. Destructuring
 *   6. to() helper
 *   7. Property shorthand
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@capstack/db';
import { createApplicant, generateSdkToken } from '@capstack/kyc';

async function to<T>(p: Promise<T>): Promise<[Error, null] | [null, T]> {
  try {
    return [null, await p];
  } catch (err) {
    return [err instanceof Error ? err : new Error(String(err)), null];
  }
}

export async function POST(req: NextRequest) {
  const [parseErr, body] = await to<{ borrowerId: string }>(req.json());
  if (parseErr) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

  // Pattern 4 — destructure
  const { borrowerId } = body!;
  if (!borrowerId) return NextResponse.json({ error: 'Missing borrowerId' }, { status: 400 });

  // Load borrower with individual sub-record
  const [loadErr, borrower] = await to(
    prisma.borrower.findUnique({
      where:   { id: borrowerId },
      include: { individual: true },
    }),
  );

  if (loadErr) return NextResponse.json({ error: 'DB error' }, { status: 500 });

  // Pattern 1 — early return
  if (!borrower) return NextResponse.json({ error: 'Borrower not found' }, { status: 404 });

  // Pattern 3 — optional chaining + nullish coalescing for name
  const fullName = borrower.individual?.fullName ?? '';

  const [applicantErr, applicant] = await to(
    createApplicant(borrowerId, fullName, borrower.email),
  );
  if (applicantErr) return NextResponse.json({ error: 'Failed to create applicant' }, { status: 500 });

  const [tokenErr, token] = await to(generateSdkToken(applicant!.id));
  if (tokenErr) return NextResponse.json({ error: 'Failed to generate SDK token' }, { status: 500 });

  // Create KycCheck record
  await to(
    prisma.kycCheck.create({
      data: {
        borrowerId,
        type:       'ID_VERIFICATION',
        provider:   'ONFIDO',
        externalId: applicant!.id,
        status:     'PENDING',
      },
    }),
  );

  // Pattern 7 — shorthand
  return NextResponse.json({ token });
}
