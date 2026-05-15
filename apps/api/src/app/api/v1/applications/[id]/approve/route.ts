/**
 * POST /api/v1/applications/[id]/approve
 *
 * Transitions an application to APPROVED and creates the Loan record.
 *
 * Patterns applied:
 *   1. Early return — application not found, wrong status
 *   3. Nullish coalescing — safe field access
 *   4. Destructuring — params
 *   6. to() helper
 *   7. Property shorthand
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@capstack/db';

async function to<T>(p: Promise<T>): Promise<[Error, null] | [null, T]> {
  try {
    return [null, await p];
  } catch (err) {
    return [err instanceof Error ? err : new Error(String(err)), null];
  }
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Pattern 4 — destructure
  const { id } = await params;

  // Load application with product (need lenderId)
  const [loadErr, application] = await to(
    prisma.application.findUnique({
      where:   { id },
      include: { product: true },
    }),
  );

  if (loadErr) return NextResponse.json({ error: 'DB error' }, { status: 500 });

  // Pattern 1 — early returns
  if (!application) return NextResponse.json({ error: 'Application not found' }, { status: 404 });
  if (!['SUBMITTED', 'UNDER_REVIEW', 'HUMAN_REVIEW', 'AUTO_DECISIONED'].includes(application.status)) {
    return NextResponse.json({ error: 'Application cannot be approved from current status' }, { status: 409 });
  }

  const now        = new Date();
  const termDays   = application.termDaysRequested;
  const maturity   = new Date(now.getTime() + termDays * 86_400_000);
  const loanNumber = `LN-${Date.now()}`;

  // Update application + create loan atomically
  const [txErr, result] = await to(
    prisma.$transaction(async (tx) => {
      const updatedApp = await tx.application.update({
        where: { id },
        data:  { status: 'APPROVED', decidedAt: now },
      });

      const loan = await tx.loan.create({
        data: {
          lenderId:              application.product.lenderId,
          borrowerId:            application.borrowerId,
          productId:             application.productId,
          applicationId:         application.id,
          loanNumber,
          principal:             application.amountRequested,
          // Pattern 3 — nullish coalescing for APR
          aprBps:                application.product.defaultAprBps ?? 1200,
          termDays,
          startDate:             now,
          maturityDate:          maturity,
          outstandingPrincipal:  application.amountRequested,
          status:                'PENDING_DISBURSEMENT',
        },
      });

      return { application: updatedApp, loan };
    }),
  );

  if (txErr) {
    console.error('[approve] transaction failed:', txErr);
    return NextResponse.json({ error: 'Failed to approve application' }, { status: 500 });
  }

  // Pattern 7 — shorthand (result already has application, loan)
  return NextResponse.json(result);
}
