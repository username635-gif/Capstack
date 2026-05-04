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
  const { principalCents, aprBps, periods } = input;
  const annualRate = aprBps / 10000; // e.g. 1200 bps → 0.12
  const periodicRate = annualRate / 12; // monthly
  const daysPerPeriod = Math.round(input.termDays / periods);

  let schedule: ScheduledPayment[];
  let totalPaymentCents: number;
  let totalInterestCents: number;

  if (periodicRate === 0) {
    // Zero-interest loan
    const installmentCents = Math.round(principalCents / periods);
    let balance = principalCents;
    const startDate = new Date();
    schedule = Array.from({ length: periods }, (_, i) => {
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
    totalPaymentCents = principalCents;
    totalInterestCents = 0;
  } else {
    // PMT = P * r / (1 - (1 + r)^-n)
    const pmt = principalCents * periodicRate / (1 - Math.pow(1 + periodicRate, -periods));
    const pmtCents = Math.round(pmt);
    let balance = principalCents;
    const startDate = new Date();
    schedule = Array.from({ length: periods }, (_, i) => {
      const interestCents = Math.round(balance * periodicRate);
      let principalCentsThisPeriod = pmtCents - interestCents;
      if (i === periods - 1) principalCentsThisPeriod = balance; // final period — pay off remainder
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
    totalPaymentCents = schedule.reduce((s, p) => s + p.totalPayment.getCents(), 0);
    totalInterestCents = totalPaymentCents - principalCents;
  }

  return {
    method: 'EQUAL_INSTALLMENT',
    payments: schedule,
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
  const { principalCents, aprBps, periods } = input;
  const periodicRate = (aprBps / 10000) / 12;
  const interestPerPeriodCents = Math.round(principalCents * periodicRate);
  const daysPerPeriod = Math.round(input.termDays / periods);
  const startDate = new Date();

  const schedule: ScheduledPayment[] = Array.from({ length: periods }, (_, i) => {
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
    payments: schedule,
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
