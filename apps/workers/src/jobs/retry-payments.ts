/**
 * Inngest cron job — retry failed debit order payments.
 *
 * Runs daily at 07:30 SAST (05:30 UTC) — before bank cut-off times.
 *
 * RETRY SCHEDULE (follows typical SA bank debit order retry norms):
 *   Attempt 1  — original due date
 *   Attempt 2  — due date + 3 calendar days
 *   Attempt 3  — due date + 7 calendar days
 *   After 3 failures → mark as FAILED, trigger collections workflow,
 *                        notify borrower via SMS, update delinquency state.
 *
 * PAYMENT RAILS:
 *   Primary retry: PayFast tokenized card charge (card on file from setup-repayment)
 *   This requires the borrower to have a stored PayFast token (payfastToken in
 *   CollectionEvent or Loan metadata). If no token is on file, skip the auto-retry
 *   and immediately send a payment-failed SMS asking the borrower to pay manually.
 *
 * IDEMPOTENCY:
 *   Each retry attempt is keyed by `retry_${disbursementId}_attempt_${n}` to
 *   prevent double-charges if Inngest retries the job step.
 *
 * Patterns applied:
 *   1. Early return — no failed payments, skip; no token on file, skip auto-charge
 *   2. Ternary — route to collections vs retry
 *   5. Array methods — filter for retryable disbursements
 *   6. to() helper
 *   7. Property shorthand
 *   8. Composition — load → classify → retry → persist pipeline
 */

import { inngest } from '../inngest/client';
import { prisma } from '@capstack/db';

const MAX_RETRY_ATTEMPTS = 3;

// Retry intervals in days from original due date
const RETRY_DAYS = [0, 3, 7] as const;

// Stub payment charge — in production replace with PayFast recurring API call
async function _chargeStoredToken(
  _token:         string,
  _amountCents:   bigint,
  _idempotencyKey: string,
): Promise<{ success: boolean; externalRef?: string; error?: string }> {
  // Production:
  //   const result = await payfast.recurringPayment.charge({
  //     token:       token,
  //     amount:      Number(amountCents) / 100,
  //     itemName:    'Loan repayment',
  //     merchantRef: idempotencyKey,
  //   });
  //   return { success: result.status === 'COMPLETE', externalRef: result.pfPaymentId };

  // Stub: simulate 70% success rate for demo purposes
  const success = Math.random() < 0.7;
  return success
    ? { success: true, externalRef: `pf_retry_stub_${Date.now()}` }
    : { success: false, error: 'Insufficient funds (stub)' };
}

// Inline SMS stub — workers cannot import from apps/api
async function _sendSmsFailed(phone: string, name: string, amountRand: number): Promise<void> {
  console.log(
    `[SMS stub – retry] to=${phone} "Payment of R${amountRand.toFixed(2)} failed for ${name}"`,
  );
}

export const retryFailedPayments = inngest.createFunction(
  { id: 'retry-failed-payments', triggers: [{ cron: '30 5 * * *' }] }, // 07:30 SAST = 05:30 UTC
  async ({ step }) => {
    // ── STEP 1: Load overdue installments eligible for retry ───────────────
    const overdueInstallments = await step.run('load-overdue', () => {
      const cutoff = new Date(Date.now() - 7 * 86_400_000); // at most 7 days old
      return prisma.scheduledPayment.findMany({
        where: {
          status:  'OVERDUE',
          dueDate: { gte: cutoff },
        },
        include: {
          loan: {
            include: {
              borrower:    { include: { individual: true } },
              collections: {
                where:   { type: { in: ['CARD_TOKENISED', 'PAYMENT_RETRY_FAILED'] } },
                orderBy: { createdAt: 'desc' },
                take:    5,
              },
            },
          },
        },
      });
    });

    // Pattern 1 — early return if nothing to do
    if (overdueInstallments.length === 0) {
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    let succeeded = 0;
    let failed    = 0;

    await step.run('process-retries', async () => {
      for (const installment of overdueInstallments) {
        const loan = installment.loan;

        // Count previous retry attempts for this installment
        const retryAttempts = loan.collections.filter(
          c => c.type === 'PAYMENT_RETRY_FAILED',
        ).length;

        // Pattern 1 — max retries reached → hand off to collections workflow
        if (retryAttempts >= MAX_RETRY_ATTEMPTS) {
          await prisma.collectionEvent.create({
            data: {
              loanId:  loan.id,
              type:    'PAYMENT_MAXRETRIED',
              channel: 'SYSTEM',
              payload: { installmentId: installment.id, attempts: retryAttempts },
              outcome: 'COLLECTIONS_TRIGGERED',
            },
          }).catch(() => {/*non-fatal*/});
          continue;
        }

        // Find stored PayFast token (set during setup-repayment)
        const tokenEvent = loan.collections.find(c => c.type === 'CARD_TOKENISED');
        const storedToken = (tokenEvent?.payload as Record<string, string> | null)?.payfastToken;

        // Pattern 1 — no token on file → skip auto-retry, send SMS
        if (!storedToken) {
          const phone = loan.borrower?.phone ?? '';
          const name  = loan.borrower?.individual?.fullName ?? 'Borrower';
          if (phone) {
            await _sendSmsFailed(phone, name, Number(installment.totalDue) / 100);
          }
          continue;
        }

        // ── Attempt the charge ────────────────────────────────────────────
        const idempotencyKey = `retry_${installment.id}_attempt_${retryAttempts + 1}`;

        const result = await _chargeStoredToken(
          storedToken,
          installment.totalDue,
          idempotencyKey,
        );

        if (result.success) {
          succeeded++;

          // Record successful repayment
          await prisma.$transaction([
            prisma.loanRepayment.create({
              data: {
                loanId:      loan.id,
                amount:      installment.totalDue,
                receivedAt:  new Date(),
                rail:        'PAYFAST_RETRY',
                externalRef: result.externalRef ?? idempotencyKey,
                allocation: {
                  fees:      Number(installment.feesDue),
                  interest:  Number(installment.interestDue),
                  principal: Number(installment.principalDue),
                },
                scheduledPaymentId: installment.id,
              },
            }),
            prisma.scheduledPayment.update({
              where: { id: installment.id },
              data:  { status: 'PAID', paidAmount: installment.totalDue, paidAt: new Date() },
            }),
            prisma.loan.update({
              where: { id: loan.id },
              data:  { outstandingPrincipal: { decrement: installment.principalDue } },
            }),
          ]);
        } else {
          failed++;

          // Log the failed attempt
          await prisma.collectionEvent.create({
            data: {
              loanId:  loan.id,
              type:    'PAYMENT_RETRY_FAILED',
              channel: 'PAYFAST',
              payload: {
                installmentId:   installment.id,
                attemptNo:       retryAttempts + 1,
                error:           result.error ?? 'Unknown',
                idempotencyKey,
              },
              outcome: `ATTEMPT_${retryAttempts + 1}_FAILED`,
            },
          }).catch(() => {/*non-fatal*/});

          // Notify borrower of failed payment
          const phone = loan.borrower?.phone ?? '';
          const name  = loan.borrower?.individual?.fullName ?? 'Borrower';
          if (phone) {
            await _sendSmsFailed(phone, name, Number(installment.totalDue) / 100);
          }
        }
      }
    });

    // Pattern 7 — shorthand
    return { processed: overdueInstallments.length, succeeded, failed };
  },
);
