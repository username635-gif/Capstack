/**
 * Daily interest accrual helpers.
 *
 * Uses actual/365 day-count convention, consistent with NCA requirements.
 *
 * Patterns applied:
 *   1. Early return — zero APR or zero balance
 *   2. Ternary — leap year detection
 *   7. Property shorthand
 *   8. Composition — accrueDaily feeds into batch accrual job
 */

export interface AccrualResult {
  dailyInterest: bigint;
  newOutstandingInterest: bigint;
}

/**
 * Returns the number of days in the current year (365 or 366 for leap years).
 * The NCA (National Credit Act) requires actual/365 day-count, so leap years
 * must use 366 to avoid over-accruing interest.
 * Pattern 2 — ternary
 */
export function daysInYear(year: number): number {
  return (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 366 : 365;
}

/**
 * Compute a single day's interest accrual.
 *
 * All arithmetic is BigInt to avoid floating-point rounding errors on large
 * loan balances. Money is always stored in cents (e.g. R1 000 = 100 000n).
 *
 * Formula:  dailyInterest = principal × APR_bps ÷ (10 000 × days_in_year)
 * Example:  R10 000 loan at 12% APR (1 200 bps) in a 365-day year:
 *           = 1 000 000n × 1 200n ÷ (10 000n × 365n)
 *           = 1 200 000 000n ÷ 3 650 000n
 *           = 328n cents (≈ R3.28/day)
 *
 * @param outstandingPrincipal  Current loan balance in cents
 * @param aprBps                Annual rate in basis points (100 bps = 1%)
 * @param forDate               The date the accrual is for (default: today)
 */
export function accrueDaily(
  outstandingPrincipal: bigint,
  aprBps:               number,
  forDate               = new Date(),
): AccrualResult {
  // Pattern 1 — early return: no interest accrues on paid-off or zero-rate loans
  if (outstandingPrincipal <= 0n || aprBps === 0) {
    return { dailyInterest: 0n, newOutstandingInterest: 0n };
  }

  const days = BigInt(daysInYear(forDate.getFullYear()));

  // Integer division truncates fractional cents — this is acceptable for daily accrual.
  // Over a year the rounding error is at most 365 cents (R3.65) on any loan.
  const dailyInterest = (outstandingPrincipal * BigInt(aprBps)) / (10_000n * days);

  // Pattern 7 — shorthand
  return { dailyInterest, newOutstandingInterest: dailyInterest };
}
