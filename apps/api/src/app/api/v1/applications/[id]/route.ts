import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@capstack/db';

async function to<T>(p: Promise<T>): Promise<[Error, null] | [null, T]> {
  try { return [null, await p]; }
  catch (err) { return [err instanceof Error ? err : new Error(String(err)), null]; }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [err, application] = await to(
    prisma.application.findUnique({
      where:   { id },
      include: {
        borrower:  { include: { individual: true, business: true } },
        product:   true,
        decisions: { orderBy: { createdAt: 'desc' }, take: 1 },
        events:    { orderBy: { createdAt: 'desc' } },
      },
    }),
  );

  if (err) return NextResponse.json({ error: err.message }, { status: 500 });
  if (!application) return NextResponse.json({ error: 'Application not found' }, { status: 404 });

  return NextResponse.json({
    ...application,
    amountRequested: Number(application.amountRequested),
    latestDecision: application.decisions[0] ? {
      ...application.decisions[0],
      approvedAmount: application.decisions[0].approvedAmount
        ? Number(application.decisions[0].approvedAmount)
        : null,
    } : null,
  });
}
