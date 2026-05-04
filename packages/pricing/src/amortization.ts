/**
 * Loan amortization schedule calculators.
 *
 * Three repayment methods are supported:
 *
 *   EQUAL_INSTALLMENT (reducing balance)
 *     Each period the borrower pays the same total amount.
 *     The split between principal and interest changes over time:
 *     early payments are mostly interest, later payments mostly principal.
 *     Formula: PMT = P × r / (1 − (1 + r)^−n)
 *       P = principal, r = periodic rate (APR / 12), n = number of periods
 *     This is the standard mortgage / personal loan structure.
 *
 *   BULLET (balloon payment)
 *     Borrower pays interest only each period.
 *     The full principal is due on the final period.
 *     Common for short-term SME / bridge loans.
 *
 *   INTEREST_ONLY
 *     Alias for BULLET in this implementation.
 *     In a stricter model, INTEREST_ONLY would have no terminal principal repayment
 *     (revolving facility), but here we treat it identically to BULLET.
 *
 * All monetary values are stored as integer cents (bigint internally via Money).
 * This avoids floating-point rounding errors on currency arithmetic.
 *
 * INPUT CONVENTION:
 *   - principalCents: loan amount in the smallest currency unit (e.g. 100000 = ZAR 1,000.00)
 *   - aprBps: Annual Percentage Rate in basis points (1 bps = 0.01%, so 1200 bps = 12.00% APR)
 *   - termDays: total loan term (used only to space due dates)
 *   - periods: number of repayment instalments (typically months)
 *
 * ROUNDING:
 *   Each period's interest and principal are rounded to the nearest cent.
 *   The final period absorbs any rounding residual so that the sum of principal
 *   repayments exactly equals the original principal.
 *
 * FUTURE IMPROVEMENTS:
 *   - Support daily accrual (actual/365) for bridging loans
 *   - Add an upfront origination fee field
 *   - Wire up to the LoanProduct fee structure from the DB schema
 */

import { Money } from '@capstack/ledger';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AmortizationMethod = 'EQUAL_INSTALLMENT' | 'BULLET' | 'INTEREST_ONLY';

export interface AmortizationScheduleInput {
  /** Loan principal in cents */
  principalCents: number;
  /** Annual Percentage Rate in basis points (e.g. 1200 = 12.00%) */
  aprBps: number;
  /** Loan term in days */
  termDays: number;
  /** Number of repayment periods (e.g. months) */
  periods: number;
  method: AmortizationMethod;
  currency?: string;
}

export interface ScheduledPayment {
  period: number;
  dueDate: Date;
  principal: Money;
  interest: Money;
  totalPayment: Money;
  remainingBalance: Money;
}

export interface AmortizationSchedule {
  method: AmortizationMethod;
  payments: ScheduledPayment[];
  totalInterest: Money;
  totalPayments: Money;
  apr: number;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// ─── Calculators ─────────────────────────────────────────────────────────────

/**
 * Calculate an equal-installment (reducing balance) amortization schedule.
 * Uses the standard annuity formula.
 */
export function calculateEqualInstallment(
  input: AmortizationScheduleInput
): AmortizationSchedule {
  // Pattern 4 — full destructuring so no repeated `input.` access below
  const { principalCents, aprBps, periods, termDays } = input;
  const annualRate = aprBps / 10000; // e.g. 1200 bps → 0.12
  const periodicRate = annualRate / 12; // monthly
  const daysPerPeriod = Math.round(termDays / periods);
  const startDate = new Date();

  // Pattern 1 — early return: handle the zero-interest edge case immediately,
  // avoiding a deeply nested if/else that spans the whole function body.
  if (periodicRate === 0) {
    const installmentCents = Math.round(principalCents / periods);
    let balance = principalCents;
    const payments = Array.from({ length: periods }, (_, i) => {
      const periodPrincipal = i === periods - 1 ? balance : installmentCents;
      balance -= periodPrincipal;
      return {
        period: i + 1,
        dueDate: addDays(startDate, daysPerPeriod * (i + 1)),
        principal: Money.fromCents(periodPrincipal),
        interest: Money.fromCents(0),
        totalPayment: Money.fromCents(periodPrincipal),
        remainingBalance: Money.fromCents(balance),
      };
    });
    return {
      method: 'EQUAL_INSTALLMENT',
      payments,                                      // Pattern 7 — shorthand
      totalInterest: Money.fromCents(0),
      totalPayments: Money.fromCents(principalCents),
      apr: aprBps / 100,
    };
  }

  // PMT = P * r / (1 - (1 + r)^-n)
  const pmt = principalCents * periodicRate / (1 - Math.pow(1 + periodicRate, -periods));
  const pmtCents = Math.round(pmt);
  let balance = principalCents;
  const payments = Array.from({ length: periods }, (_, i) => {
    const interestCents = Math.round(balance * periodicRate);
    // Pattern 2 — ternary: final period absorbs rounding residual; reads as one expression
    const principalCentsThisPeriod = i === periods - 1 ? balance : pmtCents - interestCents;
    balance = Math.max(0, balance - principalCentsThisPeriod);
    return {
      period: i + 1,
      dueDate: addDays(startDate, daysPerPeriod * (i + 1)),
      principal: Money.fromCents(principalCentsThisPeriod),
      interest: Money.fromCents(interestCents),
      totalPayment: Money.fromCents(principalCentsThisPeriod + interestCents),
      remainingBalance: Money.fromCents(balance),
    };
  });
  const totalPaymentCents = payments.reduce((s, p) => s + p.totalPayment.getCents(), 0);
  const totalInterestCents = totalPaymentCents - principalCents;

  return {
    method: 'EQUAL_INSTALLMENT',
    payments,                                          // Pattern 7 — shorthand
    totalInterest: Money.fromCents(totalInterestCents),
    totalPayments: Money.fromCents(totalPaymentCents),
    apr: aprBps / 100,
  };
}

/**
 * Calculate a bullet (balloon) amortization schedule.
 * Interest-only payments each period; full principal due on last period.
 */
export function calculateBullet(
  input: AmortizationScheduleInput
): AmortizationSchedule {
  // Pattern 4 — full destructuring including termDays; no more `input.termDays` access
  const { principalCents, aprBps, periods, termDays } = input;
  const periodicRate = (aprBps / 10000) / 12;
  const interestPerPeriodCents = Math.round(principalCents * periodicRate);
  const daysPerPeriod = Math.round(termDays / periods);
  const startDate = new Date();

  // Pattern 7 — renamed schedule → payments so the return object uses shorthand
  const payments: ScheduledPayment[] = Array.from({ length: periods }, (_, i) => {
    const isLast = i === periods - 1;
    const principalThisPeriod = isLast ? principalCents : 0;
    return {
      period: i + 1,
      dueDate: addDays(startDate, daysPerPeriod * (i + 1)),
      principal: Money.fromCents(principalThisPeriod),
      interest: Money.fromCents(interestPerPeriodCents),
      totalPayment: Money.fromCents(principalThisPeriod + interestPerPeriodCents),
      remainingBalance: Money.fromCents(isLast ? 0 : principalCents),
    };
  });

  const totalInterestCents = interestPerPeriodCents * periods;
  return {
    method: 'BULLET',
    payments,                                             // Pattern 7 — shorthand
    totalInterest: Money.fromCents(totalInterestCents),
    totalPayments: Money.fromCents(principalCents + totalInterestCents),
    apr: aprBps / 100,
  };
}

/**
 * Route to the appropriate calculator based on method.
 */
export function calculateAmortizationSchedule(
  input: AmortizationScheduleInput
): AmortizationSchedule {
  switch (input.method) {
    case 'EQUAL_INSTALLMENT':
      return calculateEqualInstallment(input);
    case 'BULLET':
    case 'INTEREST_ONLY':
      return calculateBullet(input);
    default:
      throw new Error(`Unsupported amortization method: ${input.method}`);
  }
}
