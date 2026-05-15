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

async function to<T>(p: Promise<T>): Promise<[Error, null] | [null, T]> {
  try {
    return [null, await p];
  } catch (err) {
    return [err instanceof Error ? err : new Error(String(err)), null];
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const [parseErr, body] = await to<{ reason?: string; reasonCodes?: string[] }>(req.json());
  if (parseErr) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

  // Pattern 4 — destructure with defaults (pattern 3)
  const { reason = 'Application declined', reasonCodes = [] } = body ?? {};

  const [loadErr, application] = await to(
    prisma.application.findUnique({ where: { id } }),
  );

  if (loadErr) return NextResponse.json({ error: 'DB error' }, { status: 500 });

  // Pattern 1 — early returns
  if (!application) return NextResponse.json({ error: 'Application not found' }, { status: 404 });
  if (application.status === 'REJECTED') {
    return NextResponse.json({ error: 'Already rejected' }, { status: 409 });
  }

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
          actor:         'SYSTEM',
          payload:       { reason, reasonCodes },
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
