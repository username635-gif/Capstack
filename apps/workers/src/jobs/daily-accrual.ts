/**
 * Inngest cron job — daily interest accrual.
 *
 * Runs at 01:00 UTC every day.
 * Iterates all ACTIVE loans and increments outstandingInterest.
 *
 * Patterns applied:
 *   1. Early return — skip loans with zero balance
 *   5. Array processing — map loans to update promises
 *   7. Property shorthand
 *   8. Composition — accrueDaily pipe into DB update
 */

import { inngest } from '../inngest/client';
import { prisma } from '@capstack/db';
import { accrueDaily } from '@capstack/ledger';

export const dailyAccrual = inngest.createFunction(
  { id: 'daily-accrual', triggers: [{ cron: '0 1 * * *' }] },
  async ({ step }) => {
    // Load all active loans in one query — Inngest steps are retryable,
    // so if this fails (e.g. DB timeout) Inngest will retry the whole step.
    const loans = await step.run('load-active-loans', () =>
      prisma.loan.findMany({ where: { status: 'ACTIVE' } }),
    );

    // Build all DB update operations in memory first, then run them as a single
    // atomic transaction. This means either ALL loans accrue interest today, or NONE do.
    // Pattern 5 — map into update promises, then Promise.all
    const updates = loans
      // Pattern 1 — skip fully paid-off loans (outstandingPrincipal = 0)
      .filter(loan => loan.outstandingPrincipal > 0n)
      .map(loan => {
        // Pattern 8 — accrueDaily() does the math; we just apply the result
        const { dailyInterest } = accrueDaily(loan.outstandingPrincipal, loan.aprBps);
        // increment is a Prisma atomic operator — safe against concurrent updates
        return prisma.loan.update({
          where: { id: loan.id },
          data:  { outstandingInterest: { increment: dailyInterest } },
        });
      });

    // Run as a single DB transaction — either all accrue or none do
    await step.run('apply-accruals', () => prisma.$transaction(updates));

    // Pattern 7 — shorthand
    const processed = updates.length;
    return { processed }; // returned to Inngest event log for observability
  },
);
