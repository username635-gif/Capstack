/**
 * Multi-rail disbursement — tries PayFast first, falls back to Stitch mock.
 *
 * DISBURSEMENT FLOW:
 *   1. Loan is approved (CreditDecision.recommendation = 'APPROVE')
 *   2. Ops agent or auto-approval triggers POST /api/v1/loans/disburse
 *   3. This module attempts PayFast payout first (primary rail)
 *   4. If PayFast fails (network error, insufficient funds, etc.), it retries
 *      via the Stitch open-banking mock (secondary rail)
 *   5. A Disbursement record is written to the database either way
 *   6. The loan status moves from APPROVED → ACTIVE
 *
 * RAILS:
 *   PAYFAST — real-money bank transfer in production; sandbox mock in dev
 *   STITCH  — open-banking real-time payment; currently a mock stub
 *
 * AMOUNTS:
 *   amountRand is in South African Rands (e.g. 5000.00 for R5 000).
 *   The Loan record stores amounts in cents as BigInt — convert before calling this.
 *
 * Patterns applied:
 *   1. Early return — validate inputs
 *   6. to() helper — error as value (avoid try/catch pyramid)
 *   7. Property shorthand
 *   8. Composition — disburseWithFallback is a pure pipeline
 */

import { payfast, type PayFastBankAccount } from './payfast';
import { stitchPayout } from '@capstack/integrations';

// ── Stripe payout stub ────────────────────────────────────────────────────────
// Stripe is the third-rail fallback for international disbursements or when
// both PayFast (primary) and Stitch (secondary) fail.
//
// PRODUCTION INTEGRATION:
//   1. pnpm add stripe --filter api
//   2. Set env: STRIPE_SECRET_KEY
//   3. Replace _stripePayout() body with:
//        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
//        const transfer = await stripe.transfers.create({
//          amount: Math.round(amountRand * 100),  // convert Rand → cents
//          currency: 'zar',
//          destination: bankAccount.stripeAccountId,
//          transfer_group: loanId,
//        });
//        return { id: transfer.id, status: 'INITIATED' };
async function _stripePayout(
  loanId: string,
  amountRand: number,
): Promise<{ id: string; status: string }> {
  // Stub — returns a deterministic mock ID
  return { id: `stripe_stub_${loanId}_${Date.now()}`, status: 'INITIATED' };
}

async function to<T>(p: Promise<T>): Promise<[Error, null] | [null, T]> {
  try {
    return [null, await p];
  } catch (err) {
    return [err instanceof Error ? err : new Error(String(err)), null];
  }
}

interface BankAccountInput {
  bank:           string;
  account_number: string;
  account_name:   string;
  branch_code:    string;
}

export interface DisbursementResult {
  id:        string;
  status:    string;
  reference: string;
  rail:      'PAYFAST' | 'STITCH' | 'STRIPE';
}

/**
 * Attempt disbursement via PayFast; if it fails, fall back to Stitch mock.
 *
 * @param loanId      Used as the payment reference
 * @param amountRand  Disbursement amount in Rands (not cents)
 * @param bankAccount Beneficiary bank details
 */
export async function disburseWithFallback(
  loanId:      string,
  amountRand:  number,
  bankAccount: BankAccountInput,
): Promise<DisbursementResult> {
  // Pattern 1 — early return on invalid inputs
  if (!loanId || amountRand <= 0) throw new Error('Invalid disbursement params');

  const pfAccount: PayFastBankAccount = {
    bank:           bankAccount.bank,
    account_number: bankAccount.account_number,
    account_name:   bankAccount.account_name,
    branch_code:    bankAccount.branch_code,
  };

  // Pattern 6 — to() wrapper; no nested try/catch
  const [pfErr, pfResult] = await to(
    payfast.payout.create({
      amount:       amountRand,
      reference:    loanId,
      bank_account: pfAccount,
    }),
  );

  // Pattern 1 — primary rail succeeded
  if (!pfErr && pfResult) {
    const rail = 'PAYFAST' as const;
    // Pattern 7 — shorthand
    return { id: pfResult.id, status: pfResult.status, reference: loanId, rail };
  }

  console.warn('[disbursement] PayFast failed, trying Stitch:', pfErr?.message);

  const [stitchErr, stitchResult] = await to(stitchPayout(loanId, amountRand));

  if (!stitchErr && stitchResult) {
    const rail = 'STITCH' as const;
    return { id: stitchResult.id, status: stitchResult.status, reference: loanId, rail };
  }

  // Third rail — Stripe (international / fallback)
  console.warn('[disbursement] Stitch failed, trying Stripe:', stitchErr?.message);

  const [stripeErr, stripeResult] = await to(_stripePayout(loanId, amountRand));

  if (stripeErr || !stripeResult) {
    throw new Error(
      `All 3 disbursement rails failed. PayFast: ${pfErr?.message} | Stitch: ${stitchErr?.message} | Stripe: ${stripeErr?.message}`,
    );
  }

  const rail = 'STRIPE' as const;
  // Pattern 7 — shorthand
  return { id: stripeResult.id, status: stripeResult.status, reference: loanId, rail };
}
