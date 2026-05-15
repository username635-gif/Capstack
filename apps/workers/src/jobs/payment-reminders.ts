/**
 * Inngest cron job — send payment reminders.
 *
 * Runs daily at 08:00 UTC (10:00 SAST).
 * Finds all upcoming scheduled payments due in the next 7 days and
 * sends an SMS reminder to the borrower.
 *
 * REMINDER SCHEDULE:
 *   7 days before  — "payment coming up" notice
 *   1 day before   — "payment tomorrow" notice
 *   On due date    — "payment due today" notice
 *   After due date — handled by update-delinquency.ts (overdue notices)
 *
 * WHY 08:00 SAST:
 *   POPIA Article 11(3) and the ECT Act prohibit unsolicited commercial
 *   messages outside of 8:00–21:00 in the recipient's timezone.
 *
 * Patterns applied:
 *   1. Early return — no payments due today, skip
 *   5. Array methods — filter + map for reminder targeting
 *   7. Property shorthand
 *   8. Composition — load → filter → send → log pipeline
 */

import { inngest } from '../inngest/client';
import { prisma } from '@capstack/db';

// Inline SMS stub — workers cannot import from apps/api.
// Production: replace with real Clickatell/Infobip call (same as apps/api/src/lib/notifications.ts).
async function _sendSmsStub(to: string, body: string): Promise<void> {
  console.log(`[SMS stub – worker] to=${to} body="${body.slice(0, 80)}"`);
}

export const sendPaymentReminders = inngest.createFunction(
  { id: 'send-payment-reminders', triggers: [{ cron: '0 6 * * *' }] }, // 08:00 SAST = 06:00 UTC
  async ({ step }) => {
    const now = new Date();

    // ── STEP 1: find installments due in 7, 1, or 0 days ─────────────────
    const payments = await step.run('load-upcoming-payments', () => {
      const in7days = new Date(now.getTime() + 7 * 86_400_000);
      const today   = new Date(now.toISOString().slice(0, 10));           // midnight today
      const tomorrow = new Date(today.getTime() + 86_400_000);
      const in7      = new Date(today.getTime() + 7 * 86_400_000);

      return prisma.scheduledPayment.findMany({
        where: {
          dueDate: { gte: today, lte: in7days },
          status:  { in: ['UPCOMING', 'DUE'] },
        },
        include: {
          loan: {
            include: {
              borrower: { include: { individual: true } },
            },
          },
        },
      });
    });

    // Pattern 1 — early return if nothing to do
    if (payments.length === 0) {
      return { reminded: 0 };
    }

    // ── STEP 2: send reminders ─────────────────────────────────────────────
    let reminded = 0;

    await step.run('send-reminders', async () => {
      const today = new Date().toISOString().slice(0, 10);

      const sends = payments
        .filter(p => p.loan.borrower?.phone)         // Pattern 5 — filter
        .map(async (p) => {
          const dueStr      = new Date(p.dueDate).toISOString().slice(0, 10);
          const daysDiff    = Math.round(
            (new Date(p.dueDate).getTime() - new Date(today).getTime()) / 86_400_000,
          );
          // Pattern 1 — only send reminder on exact day counts
          if (![0, 1, 7].includes(daysDiff)) return;

          const phone  = p.loan.borrower!.phone;
          const name   = p.loan.borrower?.individual?.fullName ?? 'Borrower';
          const amount = Number(p.totalDue) / 100;

          const body = daysDiff === 0
            ? `Hi ${name}, your Capstack repayment of R${amount.toFixed(2)} is DUE TODAY. Please ensure funds are available.`
            : `Hi ${name}, your Capstack repayment of R${amount.toFixed(2)} is due in ${daysDiff} day${daysDiff > 1 ? 's' : ''} on ${dueStr}. Please ensure funds are available.`;

          const [sendErr] = await _sendSmsStub(phone, body)
            .then(() => [null] as [null])
            .catch((e: Error) => [e] as [Error]);

          if (!sendErr) {
            reminded++;
            // Record the notification in DB for audit
            await prisma.notification.create({
              data: {
                borrowerId: p.loan.borrowerId,
                type:       'PAYMENT_REMINDER',
                channel:    'SMS',
                body:       `Payment reminder: R${amount.toFixed(2)} due ${dueStr}`,
                status:     'SENT',
                sentAt:     new Date(),
              },
            }).catch(() => {/* non-fatal */});
          } else {
            console.error('[payment-reminders] send failed:', sendErr);
          }
        });

      await Promise.all(sends);
    });

    return { reminded };
  },
);

// ─── Type shim removed — no cross-app imports needed ─────────────────────────
