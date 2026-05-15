/**
 * Risk-based pricing: maps risk band to APR in basis points.
 *
 * Patterns applied:
 *   1. Early return — unknown risk band falls back to highest APR
 *   7. Property shorthand (band lookup)
 *   8. Composition — getAprByRiskBand chains into loan creation
 */

// APR (Annual Percentage Rate) in basis points by risk band.
// 100 bps = 1%, so 800 bps = 8.00% APR.
//
// Band assignment is driven by classifyRiskBand() using bureau score + DTI.
// These rates are illustrative — adjust to match your product's pricing sheet
// and ensure they stay below the NCA maximum prescribed rate (currently ~27.75%
// for unsecured credit + initiation fee + monthly service fee cap).
//
// Band → typical borrower profile:
//   A — excellent credit (score ≥ 750, DTI < 30%)  → same rate as prime home loan
//   B — good credit (score ≥ 680, DTI < 40%)       → mid-prime unsecured lending
//   C — fair credit (score ≥ 620, DTI < 50%)       → higher origination risk
//   D — poor credit (score ≥ 560, DTI < 60%)       → near sub-prime threshold
//   E — high risk  (score < 560 or DTI ≥ 60%)      → maximum allowed rate
const APR_BY_BAND: Record<string, number> = {
  A: 800,   //  8.00% APR — prime borrower
  B: 1200,  // 12.00%
  C: 1800,  // 18.00%
  D: 2400,  // 24.00%
  E: 3000,  // 30.00% — highest risk (verify against current NCA prescribed rate)
};

export function getAprByRiskBand(riskBand: string): number {
  // Pattern 3 — nullish coalescing for unknown bands
  return APR_BY_BAND[riskBand] ?? APR_BY_BAND['E']!;
}

/**
 * Classify a borrower into a risk band based on dtiPct and bureau score.
 *
 * Pattern 2 — ternary chain for readable band assignment
 */
export function classifyRiskBand(dtiPct: number, bureauScore?: number): string {
  const score = bureauScore ?? 600;
  return (
    score >= 750 && dtiPct < 30 ? 'A' :
    score >= 680 && dtiPct < 40 ? 'B' :
    score >= 620 && dtiPct < 50 ? 'C' :
    score >= 560 && dtiPct < 60 ? 'D' :
    'E'
  );
}
