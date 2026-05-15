/**
 * Payment allocation — distributes a received payment across fees, interest, principal.
 *
 * NCA waterfall order: fees → interest → principal
 *
 * Patterns applied:
 *   1. Early return — zero or negative amount
 *   2. Ternary — amount remaining checks
 *   5. Array methods — reduce for totals
 *   7. Property shorthand
 *   8. Composition — pure function chains with accrual and amortization helpers
 */

export interface OutstandingBalance {
  fees:      bigint;
  interest:  bigint;
  principal: bigint;
}

export interface AllocationResult {
  feesAllocated:      bigint;
  interestAllocated:  bigint;
  principalAllocated: bigint;
  overpayment:        bigint; // positive if payment exceeds total outstanding
}

/**
 * Allocate a payment using the NCA waterfall (fees → interest → principal).
 *
 * @param payment     Amount received in cents
 * @param outstanding Current outstanding balances
 */
export function allocatePayment(
  payment:     bigint,
  outstanding: OutstandingBalance,
): AllocationResult {
  // Pattern 1 — early return on non-positive payment
  if (payment <= 0n) {
    return { feesAllocated: 0n, interestAllocated: 0n, principalAllocated: 0n, overpayment: 0n };
  }

  let remaining = payment;

  // 1. Fees first
  const feesAllocated = remaining >= outstanding.fees ? outstanding.fees : remaining;
  remaining -= feesAllocated;

  // 2. Interest second — pattern 2 ternary
  const interestAllocated = remaining >= outstanding.interest ? outstanding.interest : remaining;
  remaining -= interestAllocated;

  // 3. Principal last
  const principalAllocated = remaining >= outstanding.principal ? outstanding.principal : remaining;
  remaining -= principalAllocated;

  const overpayment = remaining;

  // Pattern 7 — shorthand
  return { feesAllocated, interestAllocated, principalAllocated, overpayment };
}

/**
 * Compute total outstanding balance across all components.
 * Pattern 5 — reduce
 */
export function totalOutstanding(outstanding: OutstandingBalance): bigint {
  return [outstanding.fees, outstanding.interest, outstanding.principal].reduce(
    (sum, v) => sum + v,
    0n,
  );
}
