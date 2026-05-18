/**
 * POST /api/v1/applications/[id]/reject
 *
 * Transitions an application to REJECTED and records the reason.
 *
 * Patterns applied:
 *   1. Early return — not found, wrong status
 *   4. Destructuring
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

type RejectionBody = {
  actor?: string;
  reason?: string;
  reasonCodes?: string[];
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

  const { id } = await params;

  const [parseErr, body] = await to<RejectionBody>(req.json());
  if (parseErr) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

  // Pattern 4 — destructure with defaults (pattern 3)
  const {
    actor: inputActor,
    reason = 'Application declined',
    reasonCodes = [],
    overrideReason,
  } = body ?? {};
  const actor = auth.identity.actor;

  const [loadErr, application] = await to(
    prisma.application.findFirst({
      where: {
        id,
        product: { is: { lenderId: auth.identity.lenderId } },
      },
      include: {
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
  if (application.status === 'REJECTED') {
    return NextResponse.json({ error: 'Already rejected' }, { status: 409 });
  }

  const latestDecision = application.decisions[0] ?? null;
  const modelRecommendation = latestDecision?.recommendation ?? null;
  const isOverride = modelRecommendation !== null && modelRecommendation !== 'DECLINE';

  const [txErr, updated] = await to(
    prisma.$transaction(async (tx) => {
      const app = await tx.application.update({
        where: { id },
        data:  { status: 'REJECTED', decidedAt: new Date() },
      });

      await tx.applicationEvent.create({
        data: {
          applicationId: id,
          type:          'REJECTED',
          actor,
          payload:       {
            reason,
            reasonCodes,
            modelRecommendation,
            overrideReason: overrideReason?.trim() || null,
            overridden: isOverride,
            modelVersion: latestDecision?.modelVersion ?? null,
            pdScore: latestDecision?.pdScore ?? null,
            riskBand: latestDecision?.riskBand ?? null,
          },
        },
      });

      await tx.auditLog.create({
        data: {
          actor,
          actorType: 'USER',
          action: isOverride ? 'APPLICATION_REJECTED_WITH_OVERRIDE' : 'APPLICATION_REJECTED',
          resource: 'APPLICATION',
          resourceId: id,
          after: {
            status: 'REJECTED',
            reason,
            reasonCodes,
            modelRecommendation,
            overrideReason: overrideReason?.trim() || null,
            overridden: isOverride,
          },
        },
      });

      return app;
    }),
  );

  if (txErr) {
    console.error('[reject] transaction failed:', txErr);
    return NextResponse.json({ error: 'Failed to reject application' }, { status: 500 });
  }

  // Pattern 7 — shorthand
  return NextResponse.json({ application: updated });
}
