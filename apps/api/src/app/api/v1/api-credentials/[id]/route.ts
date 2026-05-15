/**
 * DELETE /api/v1/api-credentials/[id]
 *
 * Revokes an API credential by setting isActive = false.
 * Hard deletion is not used — we keep the record for audit purposes.
 *
 * Patterns applied:
 *   1. Early return — DB error
 *   4. Destructuring — params
 *   7. Property shorthand
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@capstack/db';

async function to<T>(p: Promise<T>): Promise<[Error, null] | [null, T]> {
  try { return [null, await p]; }
  catch (err) { return [err instanceof Error ? err : new Error(String(err)), null]; }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const [err, updated] = await to(
    prisma.apiCredential.update({
      where: { id },
      data:  { isActive: false },
    }),
  );
  if (err) return NextResponse.json({ error: err.message }, { status: 500 });

  return NextResponse.json({ revoked: true, id: updated!.id });
}
