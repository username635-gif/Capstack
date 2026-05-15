/**
 * POST /api/v1/loans/[id]/restructure
 *
 * Proposes a loan restructure offer (extend term, waive fees).
 * The offer is stored as PROPOSED and must be ACCEPTED by the borrower.
 *
 * Patterns applied:
 *   1. Early return — loan not found
 *   3. Nullish coalescing — default fee waiver
 *   4. Destructuring
 *   6. to() helper
 *   7. Property shorthand
 *   8. Composition — load loan → build new schedule → persist offer
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@capstack/db';
import { generateSchedule } from '@capstack/ledger';

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

  const [parseErr, body] = await to<{ newTermMonths?: number; feeWaiver?: number }>(req.json());
  if (parseErr) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

  // Pattern 4 — destructure with pattern 3 defaults
  const { newTermMonths = 12, feeWaiver = 0 } = body ?? {};

  // Load the loan
  const [loanErr, loan] = await to(
    prisma.loan.findUnique({
      where:   { id },
      include: { schedule: { orderBy: { installmentNo: 'asc' } } },
    }),
  );

  if (loanErr) return NextResponse.json({ error: 'DB error' }, { status: 500 });

  // Pattern 1 — early return
  if (!loan) return NextResponse.json({ error: 'Loan not found' }, { status: 404 });

  // Pattern 8 — compose: build new schedule from current outstanding principal
  const newSchedule = generateSchedule(
    loan.outstandingPrincipal,
    loan.aprBps,
    newTermMonths,
    new Date(),
  );

  const oldSchedule = loan.schedule.map(({ installmentNo, dueDate, totalDue }) => ({
    installmentNo,
    dueDate,
    totalDue: totalDue.toString(),
  }));

  const [offerErr] = await to(
    prisma.restructureOffer.upsert({
      where:  { loanId: id },
      create: {
        loanId:       id,
        oldSchedule,
        newSchedule:  newSchedule.entries.map(e => ({
          month:        e.month,
          dueDate:      e.dueDate,
          interest:     e.interest.toString(),
          principal:    e.principal.toString(),
          totalPayment: e.totalPayment.toString(),
        })),
        feesWaived: BigInt(feeWaiver ?? 0),
        status:     'PROPOSED',
      },
      update: {
        newSchedule: newSchedule.entries.map(e => ({
          month:        e.month,
          dueDate:      e.dueDate,
          interest:     e.interest.toString(),
          principal:    e.principal.toString(),
          totalPayment: e.totalPayment.toString(),
        })),
        feesWaived: BigInt(feeWaiver ?? 0),
        status:     'PROPOSED',
      },
    }),
  );

  if (offerErr) {
    console.error('[restructure] DB error:', offerErr);
    return NextResponse.json({ error: 'Failed to create restructure offer' }, { status: 500 });
  }

  const message = 'Restructure offered';
  // Pattern 7 — shorthand
  return NextResponse.json({ message });
}
