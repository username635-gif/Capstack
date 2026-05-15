/**
 * IFRS 9 Expected Credit Loss (ECL) calculator.
 *
 * ECL = PD × LGD × EAD
 *   PD  — Probability of Default (derived from DPD stage)
 *   LGD — Loss Given Default (static 50% assumption; refine with historical data)
 *   EAD — Exposure At Default (outstanding principal + interest + fees)
 *
 * IFRS 9 stages:
 *   Stage 1 — Performing (DPD 0):      12-month ECL
 *   Stage 2 — Under-performing (DPD 1-89): Lifetime ECL
 *   Stage 3 — Non-performing (DPD 90+):    Lifetime ECL, credit-impaired
 *
 * Patterns applied:
 *   1. Early return — skip zero-exposure loans
 *   2. Ternary — PD lookup per stage
 *   5. Array methods — reduce for portfolio ECL
 *   7. Property shorthand
 *   8. Composition — pure computeEcl function, chains with reporting jobs
 */

import { prisma } from '@capstack/db';

export interface EclResult {
  totalEcl:    bigint;
  loanCount:   number;
  stage1Ecl:   bigint;
  stage2Ecl:   bigint;
  stage3Ecl:   bigint;
}

/**
 * Simplified PD (Probability of Default) lookup table by DPD (Days Past Due).
 *
 * In production, replace these with model-derived PDs from the ML serving layer
 * (see ml/serving/app.py). The current values are conservative estimates based
 * on typical SA unsecured lending portfolios.
 *
 * DPD → IFRS 9 stage mapping:
 *   0 DPD         → Stage 1 (performing)       — 12-month ECL
 *   1–29 DPD      → Stage 2 (under-performing) — lifetime ECL triggered at 30+ DPD
 *   30–89 DPD     → Stage 2 (doubtful)        — lifetime ECL
 *   90+ DPD       → Stage 3 (credit-impaired) — lifetime ECL, stop interest accrual
 *
 * To integrate real PDs: call the /predict ML endpoint and use the returned `pd`
 * field instead of this lookup table.
 */
function pdByDpd(dpd: number): number {
  // Pattern 2 — ternary chain
  return (
    dpd === 0  ? 0.01  :   // 1%  — Stage 1: 12-month ECL only
    dpd < 30   ? 0.10  :   // 10% — Stage 2: lifetime ECL, under-performing
    dpd < 90   ? 0.30  :   // 30% — Stage 2: lifetime ECL, doubtful
    0.80                    // 80% — Stage 3: credit-impaired, near total loss
  );
}

// LGD (Loss Given Default): fraction of outstanding balance lost if the borrower defaults.
// 50% is a conservative starting assumption for unsecured SA lending.
// Refine with historical recovery data as the portfolio matures.
const LGD = 0.50;

export async function computeEcl(): Promise<EclResult> {
  const loans = await prisma.loan.findMany({
    where: { status: { in: ['ACTIVE', 'DEFAULTED'] } },
    select: {
      id:                 true,
      daysPastDue:        true,
      outstandingPrincipal: true,
      outstandingInterest:  true,
      outstandingFees:      true,
    },
  });

  // Pattern 5 — reduce for portfolio totals
  type EclAccumulator = { totalEcl: bigint; stage1Ecl: bigint; stage2Ecl: bigint; stage3Ecl: bigint };

  const { totalEcl, stage1Ecl, stage2Ecl, stage3Ecl } = loans.reduce<EclAccumulator>(
    (acc, loan) => {
      const ead = loan.outstandingPrincipal + loan.outstandingInterest + loan.outstandingFees;

      // Pattern 1 — skip zero-exposure
      if (ead === 0n) return acc;

      const pd  = pdByDpd(loan.daysPastDue);
      const ecl = BigInt(Math.round(Number(ead) * pd * LGD));

      // Pattern 2 — ternary for stage bucketing
      const stage =
        loan.daysPastDue === 0 ? 1 :
        loan.daysPastDue < 90  ? 2 :
        3;

      return {
        totalEcl:  acc.totalEcl  + ecl,
        stage1Ecl: stage === 1 ? acc.stage1Ecl + ecl : acc.stage1Ecl,
        stage2Ecl: stage === 2 ? acc.stage2Ecl + ecl : acc.stage2Ecl,
        stage3Ecl: stage === 3 ? acc.stage3Ecl + ecl : acc.stage3Ecl,
      };
    },
    { totalEcl: 0n, stage1Ecl: 0n, stage2Ecl: 0n, stage3Ecl: 0n },
  );

  const loanCount = loans.length;
  // Pattern 7 — shorthand
  return { totalEcl, loanCount, stage1Ecl, stage2Ecl, stage3Ecl };
}
