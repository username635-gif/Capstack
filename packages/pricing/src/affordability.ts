/**
 * NCA-compliant affordability calculator.
 *
 * All monetary values are BigInt cents to avoid floating-point errors.
 *
 * Patterns applied:
 *   1. Early return — guard zero income
 *   2. Ternary — boolean expression
 *   7. Property shorthand
 */

export interface AffordabilityResult {
  disposable:   bigint; // monthly disposable income in cents
  canAfford:    boolean;
  dtiPct:       number; // debt-to-income ratio as a percentage (0–100)
}

export function computeAffordability(
  monthlyIncome:      bigint,
  monthlyExpenses:    bigint,
  requestedInstallment: bigint,
): AffordabilityResult {
  // Pattern 1 — early return on zero income
  if (monthlyIncome === 0n) {
    return { disposable: 0n, canAfford: false, dtiPct: 100 };
  }

  const disposable = monthlyIncome - monthlyExpenses;
  // Pattern 2 — ternary
  const canAfford  = disposable >= requestedInstallment;
  // Scale to percentage (BigInt division, then convert)
  const dtiPct     = Number((requestedInstallment * 10000n) / monthlyIncome) / 100;

  // Pattern 7 — shorthand
  return { disposable, canAfford, dtiPct };
}
