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
import { authorizeOpsRequest } from '@/lib/ops-auth';

const APPLICATION_WRITE_ROLES = ['ADMIN', 'UNDERWRITER', 'CREDIT_OFFICER'];

async function to<T>(p: Promise<T>): Promise<[Error, null] | [null, T]> {
  try {
    return [null, await p];
  } catch (err) {
    return [err instanceof Error ? err : new Error(String(err)), null];
  }
}

type ApprovalBody = {
  actor?: string;
  rationale?: string;
  overrideReason?: string;
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authorizeOpsRequest(req, APPLICATION_WRITE_ROLES);
  if (!auth.ok) {
    return auth.response;
  }

  // Pattern 4 — destructure
  const { id } = await params;
  const [parseErr, body] = await to<ApprovalBody>(req.json());
  const approvalBody = parseErr ? {} : (body ?? {});
  const actor = auth.identity.actor;
  const rationale = approvalBody.rationale?.trim() || 'Approved from ops workspace.';
  const overrideReason = approvalBody.overrideReason?.trim() || null;

  // Load application with product (need lenderId)
  const [loadErr, application] = await to(
    prisma.application.findFirst({
      where: {
        id,
        product: { is: { lenderId: auth.identity.lenderId } },
      },
      include: {
        product: true,
        decisions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            recommendation: true,
            modelVersion: true,
            pdScore: true,
            riskBand: true,
          },
        },
      },
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
  const latestDecision = application.decisions[0] ?? null;
  const modelRecommendation = latestDecision?.recommendation ?? null;
  const isOverride = modelRecommendation !== null && modelRecommendation !== 'APPROVE';

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

      await tx.applicationEvent.create({
        data: {
          applicationId: id,
          type:          'APPROVED',
          actor,
          payload: {
            rationale,
            modelRecommendation,
            overrideReason,
            overridden: isOverride,
            modelVersion: latestDecision?.modelVersion ?? null,
            pdScore: latestDecision?.pdScore ?? null,
            riskBand: latestDecision?.riskBand ?? null,
            loanNumber,
          },
        },
      });

      await tx.auditLog.create({
        data: {
          actor,
          actorType: 'USER',
          action: isOverride ? 'APPLICATION_APPROVED_WITH_OVERRIDE' : 'APPLICATION_APPROVED',
          resource: 'APPLICATION',
          resourceId: id,
          after: {
            status: 'APPROVED',
            rationale,
            modelRecommendation,
            overrideReason,
            overridden: isOverride,
            loanNumber,
          },
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
