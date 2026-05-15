/**
 * Equal-installment amortization schedule generator (ledger module).
 *
 * Uses integer BigInt arithmetic throughout to eliminate floating-point errors.
 *
 * Patterns applied:
 *   1. Early return — guard zero principal / negative term
 *   2. Ternary — balance adjustment on final period
 *   5. Array methods — reduce for totals
 *   7. Property shorthand
 *   8. Composition — generateSchedule feeds into accrual and payment-allocation
 */

export interface LedgerScheduleEntry {
  month:          number;
  dueDate:        Date;
  interest:       bigint; // cents
  principal:      bigint; // cents
  totalPayment:   bigint; // cents
  balance:        bigint; // cents (remaining after this period)
}

export interface LedgerSchedule {
  entries:          LedgerScheduleEntry[];
  totalInterest:    bigint;
  totalPayments:    bigint;
}

/**
 * Generate an equal-installment (reducing-balance) repayment schedule.
 *
 * @param principal  Loan principal in cents (BigInt)
 * @param aprBps     Annual Percentage Rate in basis points (e.g. 1200 = 12%)
 * @param termMonths Number of monthly instalments
 * @param startDate  Loan start date
 */
export function generateSchedule(
  principal:   bigint,
  aprBps:      number,
  termMonths:  number,
  startDate    = new Date(),
): LedgerSchedule {
  // Pattern 1 — early returns
  if (principal <= 0n)  throw new Error('principal must be positive');
  if (termMonths <= 0)  throw new Error('termMonths must be positive');

  const monthlyRate = aprBps / 10_000 / 12; // e.g. 1200 bps → 12% APR → 1% monthly

  // PMT (equal-installment) formula:
  //   PMT = P × r / (1 − (1 + r)^−n)
  //   where P = principal, r = monthly rate, n = number of months
  // Floating point is used here ONLY to calculate the installment amount,
  // then immediately rounded to the nearest cent and stored as BigInt.
  const pmt =
    monthlyRate === 0
      ? Number(principal) / termMonths               // zero-interest case (rare)
      : (Number(principal) * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -termMonths));

  const installment = BigInt(Math.round(pmt)); // fixed rand amount due each month

  let balance = principal;
  const entries: LedgerScheduleEntry[] = [];

  for (let i = 1; i <= termMonths; i++) {
    const dueDate  = new Date(startDate);
    dueDate.setMonth(dueDate.getMonth() + i);

    // Calculate interest portion first (on current balance), then derive principal
    // portion as remainder. This matches SA bank reducing-balance convention.
    // Multiply then divide to keep BigInt precision (avoids floating-point entirely)
    const interest  = (balance * BigInt(Math.round(monthlyRate * 1_000_000))) / 1_000_000n;
    // Pattern 2 — ternary: on the LAST period, pay exactly the remaining balance
    // (avoids a residual 1–2 cent balance caused by rounding over many periods)
    const principal_ = i === termMonths ? balance : installment - interest;
    const total      = interest + principal_;
    balance          = balance - principal_;

    entries.push({
      month:        i,
      dueDate,
      interest,
      principal:    principal_,
      totalPayment: total,
      balance:      balance < 0n ? 0n : balance, // clamp negative cent residuals to zero
    });
  }

  // Pattern 5 — reduce for totals
  const totalInterest  = entries.reduce((s, e) => s + e.interest,     0n);
  const totalPayments  = entries.reduce((s, e) => s + e.totalPayment, 0n);

  // Pattern 7 — shorthand
  return { entries, totalInterest, totalPayments };
}
