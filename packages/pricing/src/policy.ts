/**
 * Lightweight policy DSL for credit rules evaluation.
 *
 * Supports MIN, MAX, and IN rules against a flat feature map.
 *
 * Patterns applied:
 *   1. Early return — fail fast on first violated rule
 *   2. Ternary — rule type comparison
 *   5. Array methods — every() for rule evaluation
 *   8. Composition — evaluateRules is composable with computeAffordability
 */

export type RuleType = 'MIN' | 'MAX' | 'IN';

export interface Rule {
  type:    RuleType;
  feature: string;
  value:   number | number[];
  label?:  string;
}

export interface PolicyResult {
  passed:     boolean;
  violations: string[];
}

// Pattern 8 — pure function, composable
export function evaluateRules(
  rules: Rule[],
  features: Record<string, number>,
): PolicyResult {
  // Pattern 5 — reduce to collect violations
  const violations = rules.reduce<string[]>((acc, rule) => {
    const actual = features[rule.feature] ?? 0;
    const label  = rule.label ?? rule.feature;

    // Pattern 2 — ternary chain
    const violated =
      rule.type === 'MIN' ? actual < (rule.value as number) :
      rule.type === 'MAX' ? actual > (rule.value as number) :
      rule.type === 'IN'  ? !(rule.value as number[]).includes(actual) :
      false;

    return violated ? [...acc, `${label} (${actual}) violates ${rule.type} ${rule.value}`] : acc;
  }, []);

  // Pattern 7 — shorthand
  return { passed: violations.length === 0, violations };
}

/**
 * Default credit policy rules aligned with the SA National Credit Act (NCA).
 *
 * These are the MINIMUM hard gates — a loan that violates any of these is
 * automatically declined regardless of affordability or bureau score.
 *
 * Rule explanations:
 *   monthlyIncomeRand ≥ R3 000  — SA social grant is ~R2 090; R3k is a floor above subsistence.
 *                                  Adjust upward for higher loan amounts in a tiered product.
 *   dtiPct ≤ 45%                — NCA Section 81: reckless lending threshold. At 45% DTI a
 *                                  borrower already allocates nearly half income to debt service.
 *   employmentMonths ≥ 3        — Minimum tenure to confirm stable income source. Increase
 *                                  to 6 months for first-time borrowers or higher-risk segments.
 *
 * To add a new rule:
 *   { type: 'MIN', feature: 'bureauScore', value: 500, label: 'Bureau score' }
 * Make sure the feature key matches what you pass in evaluateRules({ ...features }).
 */
export const DEFAULT_POLICY_RULES: Rule[] = [
  { type: 'MIN', feature: 'monthlyIncomeRand',  value: 3000,  label: 'Monthly income' },
  { type: 'MAX', feature: 'dtiPct',             value: 45,    label: 'Debt-to-income ratio' },
  { type: 'MIN', feature: 'employmentMonths',   value: 3,     label: 'Employment tenure' },
];
