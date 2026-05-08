/**
 * Multi-rail disbursement — tries PayFast first, falls back to Stitch mock.
 *
 * Patterns applied:
 *   1. Early return — validate inputs
 *   6. to() helper — error as value (avoid try/catch pyramid)
 *   7. Property shorthand
 *   8. Composition — disburseWithFallback is a pure pipeline
 */

import { payfast, type PayFastBankAccount } from './payfast';
import { stitchPayout } from '@capstack/integrations';

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
  rail:      'PAYFAST' | 'STITCH';
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

  console.warn('[disbursement] PayFast failed, trying Stitch mock:', pfErr?.message);

  const [stitchErr, stitchResult] = await to(stitchPayout(loanId, amountRand));

  if (stitchErr || !stitchResult) {
    throw new Error(`Both disbursement rails failed. PayFast: ${pfErr?.message}`);
  }

  const rail = 'STITCH' as const;
  // Pattern 7 — shorthand
  return { id: stitchResult.id, status: stitchResult.status, reference: loanId, rail };
}
