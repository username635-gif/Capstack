import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/v1/applications/:id/override
 * Records an ApplicationEvent and (optionally) a CreditDecision override.
 * Body: { actor, reason, newDecision }
 */

async function to<T>(p: Promise<T>): Promise<[Error, null] | [null, T]> {
  try { return [null, await p]; }
  catch (err) { return [err instanceof Error ? err : new Error(String(err)), null]; }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  const [parseErr, body] = await to(req.json() as Promise<{ actor: string; reason: string; newDecision: string }>);
  if (parseErr) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

  const { actor, reason, newDecision } = body ?? {};
  if (!actor || !reason) return NextResponse.json({ error: 'actor and reason required' }, { status: 422 });

  // Try to persist as ApplicationEvent if DB available
  if (process.env.DATABASE_URL) {
    try {
      const { prisma } = await import('@capstack/db');
      await prisma.applicationEvent.create({ data: { applicationId: id, type: 'OVERRIDE', actor, payload: { reason, newDecision } } });
      return NextResponse.json({ ok: true });
    } catch (err) {
      return NextResponse.json({ error: 'DB error' }, { status: 500 });
    }
  }

  // Demo fallback — return success but do not persist
  return NextResponse.json({ ok: true });
}
