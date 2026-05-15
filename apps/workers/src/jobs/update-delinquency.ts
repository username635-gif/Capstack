/**
 * Inngest cron job — update DPD (Days Past Due) buckets.
 *
 * Runs at 02:00 UTC every day.
 * Compares today's date against each loan's next scheduled payment due date,
 * then writes daysPastDue and delinquencyState back to the Loan record.
 *
 * DPD buckets (aligned with SA SARB reporting):
 *   0          CURRENT
 *   1–3        BUCKET_1
 *   4–14       BUCKET_2
 *   15–30      BUCKET_3
 *   31–60      NPL (sub-standard)
 *   61–90      NPL (doubtful)
 *   > 90       NPL / WRITTEN_OFF candidate
 *
 * Patterns applied:
 *   1. Early return — skip loans with no scheduled payment
 *   2. Ternary — DPD → bucket mapping
 *   5. Array methods — map + filter
 *   7. Property shorthand
 *   8. Composition — classify + persist pipeline
 */

import { inngest } from '../inngest/client';
import { prisma } from '@capstack/db';
import { collectionsAgent } from '@capstack/ai';

// DPD (Days Past Due) buckets aligned with SA SARB reporting requirements.
// These bucket names are written to Loan.delinquencyState in the DB and used
// in ops dashboards and IFRS 9 stage classification.
//
// Bucket → SARB meaning:
//   CURRENT    — 0 DPD — performing, no action
//   BUCKET_1   — 1–3 DPD — early warning (may be timing issue)
//   BUCKET_2   — 4–14 DPD — collections triggered
//   BUCKET_3   — 15–30 DPD — escalated collections
//   NPL        — 31–90 DPD — Non-Performing Loan (provisioning required under IFRS 9)
//   WRITTEN_OFF — 90+ DPD — candidate for write-off (requires credit committee approval)
function classifyDelinquency(dpd: number): string {
  // Pattern 2 — ternary chain
  return (
    dpd === 0        ? 'CURRENT'   :
    dpd <= 3         ? 'BUCKET_1'  :
    dpd <= 14        ? 'BUCKET_2'  :
    dpd <= 30        ? 'BUCKET_3'  :
    dpd <= 90        ? 'NPL'       :
    'WRITTEN_OFF'
  );
}

export const updateDelinquency = inngest.createFunction(
  { id: 'update-delinquency', triggers: [{ cron: '0 2 * * *' }] },
  async ({ step }) => {
    const loans = await step.run('load-active-loans', () =>
      prisma.loan.findMany({
        where:   { status: 'ACTIVE' },
        include: {
          schedule: {
            where:   { status: { in: ['DUE', 'OVERDUE', 'UPCOMING'] } },
            orderBy: { dueDate: 'asc' },
            take:    1,
          },
        },
      }),
    );

    const now = Date.now();

    // Pattern 5 — filter + map
    const updates = loans
      .filter(loan => loan.schedule.length > 0)            // Pattern 1 — skip if no schedule
      .map(loan => {
        const nextDue  = new Date(loan.schedule[0]!.dueDate).getTime();
        const daysPastDue = Math.max(0, Math.ceil((now - nextDue) / 86_400_000));
        const delinquencyState = classifyDelinquency(daysPastDue);

        return prisma.loan.update({
          where: { id: loan.id },
          // Pattern 7 — shorthand
          data:  { daysPastDue, delinquencyState },
        });
      });

    await step.run('persist-dpd', () => prisma.$transaction(updates));

    // Trigger collection actions for every delinquent loan
    await step.run('trigger-collections', async () => {
      const delinquentLoans = loans.filter(l => l.schedule.length > 0 && l.daysPastDue > 0);
      const actions = delinquentLoans.map(loan =>
        collectionsAgent({
          loanId:      loan.id,
          borrowerId:  loan.borrowerId,
          daysPastDue: loan.daysPastDue,
          outstanding: Number(loan.outstandingPrincipal) + Number(loan.outstandingInterest),
        }),
      );
      // Persist collection events (skip NONE actions)
      const events = actions.filter(a => a.action !== 'NONE').map(a =>
        prisma.collectionEvent.create({
          data: {
            loanId:    a.loanId,
            type:    a.action,
            channel: a.action.includes('SMS') ? 'SMS' : a.action.includes('EMAIL') ? 'EMAIL' : a.action.includes('CALL') ? 'PHONE' : 'SYSTEM',
            payload: { message: a.message, priority: a.priority },
          },
        }),
      );
      if (events.length > 0) await prisma.$transaction(events);
      return { collectionActionsTriggered: events.length };
    });

    const processed = updates.length;
    return { processed };
  },
);
