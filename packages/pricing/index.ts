/**
 * @package @capstack/pricing
 *
 * Loan amortization calculators for the Capstack platform.
 *
 * SUPPORTED METHODS:
 *   EQUAL_INSTALLMENT  — Standard reducing-balance (PMT formula). Each period
 *                         payment is equal; interest portion declines over time.
 *                         Used for: personal loans, term loans.
 *
 *   BULLET             — Interest-only payments each period; full principal
 *                         repaid on the last period. Used for: bridging finance,
 *                         short-term commercial loans.
 *
 *   INTEREST_ONLY      — Alias for BULLET (same calculation).
 *
 * USAGE:
 *   import { calculateAmortizationSchedule } from '@capstack/pricing';
 *
 *   const schedule = calculateAmortizationSchedule({
 *     principalCents: 500000,  // R5,000.00
 *     aprBps:         1200,    // 12.00% APR
 *     termDays:       180,
 *     periods:        6,       // 6 monthly payments
 *     method:         'EQUAL_INSTALLMENT',
 *   });
 *
 * TODO (next developer):
 *   - Add DECLINING_BALANCE method
 *   - Add fee capitalisation (origination fee added to principal)
 *   - Add an API endpoint that returns a schedule for a given application
 *   - Add unit tests using Vitest
 */
export { calculateAmortizationSchedule, calculateEqualInstallment, calculateBullet } from './src/amortization';
export type { AmortizationSchedule, AmortizationScheduleInput, ScheduledPayment, AmortizationMethod } from './src/amortization';

// ── Underwriting modules ──────────────────────────────────────────────────────
export { computeAffordability } from './src/affordability';
export type { AffordabilityResult } from './src/affordability';
export { evaluateRules, DEFAULT_POLICY_RULES } from './src/policy';
export type { Rule, RuleType, PolicyResult } from './src/policy';
export { getAprByRiskBand, classifyRiskBand } from './src/pricing';

