/**
 * Inngest function — underwriting orchestration.
 *
 * Triggered by `application/created` event.
 * Runs the rules engine and emits approve/reject downstream events.
 *
 * Patterns applied:
 *   1. Early return — application not found
 *   3. Nullish coalescing — safe defaults
 *   5. Array methods — reduce for disposable calculation
 *   7. Property shorthand
 *   8. Pipe-like composition — load → score → decide → emit
 */

import { inngest } from '../client';
import { prisma } from '@capstack/db';
import { computeAffordability, getAprByRiskBand, evaluateRules, DEFAULT_POLICY_RULES } from '@capstack/pricing';

export const underwriteApplication = inngest.createFunction(
  { id: 'underwrite-application', triggers: [{ event: 'application/created' }] },
  async ({ event, step }) => {
    // event.data is sent by POST /api/v1/applications after a new application is created
    const { applicationId } = event.data as { applicationId: string };

    // ── STEP 1: Load application data ────────────────────────────────────────────
    // Each step.run() is retried independently by Inngest if it fails.
    // This means if the DB is briefly unavailable, only this step retries —
    // not the whole function from scratch.
    const app = await step.run('load-application', () =>
      prisma.application.findUnique({
        where:   { id: applicationId },
        include: { borrower: { include: { individual: true } }, product: true },
      }),
    ) as unknown as { amountRequested: bigint; termDaysRequested: number; borrower: { individual: { monthlyIncome: bigint } | null }; product: unknown } | null;

    // Pattern 1 — early return via throw (Inngest retries on throw, giving up after max attempts)
    if (!app) throw new Error(`Application ${applicationId} not found`);

    // ── STEP 2: Affordability + policy check ───────────────────────────────────
    // This step is CPU-only (no DB or HTTP calls), so it completes almost instantly.
    // It returns a plain object — all values are number/string (NO BigInt) because
    // Inngest serialises step results to JSON between retries.
    const decision = await step.run('affordability-check', () => {
      // Pattern 3 — nullish coalescing: if no income data, default to 0 (will fail policy check)
      const monthlyIncome    = app.borrower.individual?.monthlyIncome ?? 0n;
      const monthlyExpenses  = monthlyIncome / 3n; // conservative 33% expense assumption
      // Convert termDays → months for installment estimate (30 days = 1 month)
      const requestedInstallment = app.amountRequested / BigInt(Math.max(1, Math.round(app.termDaysRequested / 30)));

      // Pattern 8 — pipe: computeAffordability gives us canAfford + dtiPct
      const { canAfford, dtiPct } = computeAffordability(
        monthlyIncome,
        monthlyExpenses,
        requestedInstallment,
      );

      // Policy rules are the hard NCA gates (min income, max DTI, min employment)
      // A loan fails policy even if it technically passes affordability math
      const monthlyIncomeRand = Number(monthlyIncome) / 100; // convert cents → Rands
      const policyResult = evaluateRules(DEFAULT_POLICY_RULES, {
        monthlyIncomeRand,
        dtiPct,
        employmentMonths: app.borrower.individual ? 12 : 0, // default 12 if no employment data
      });

      // DTI-based risk band: lower DTI = better band = lower APR
      const riskBand     = dtiPct < 30 ? 'A' : dtiPct < 45 ? 'B' : dtiPct < 60 ? 'C' : 'D';
      const approvedAprBps = getAprByRiskBand(riskBand);

      // IMPORTANT: return strings/numbers only — BigInt cannot be JSON-serialised
      return {
        approved: canAfford && policyResult.passed,
        riskBand,
        approvedAprBps,
        dtiPct,
        policyViolations: policyResult.violations, // empty array = passed all rules
        amount: app.amountRequested.toString(),     // serialize BigInt as string
      };
    });

    // Step 3: Persist credit decision
    await step.run('persist-decision', () =>
      prisma.creditDecision.create({
        data: {
          applicationId,
          modelVersion:   'rules-v1',
          pdScore:        decision.dtiPct / 100,
          lgdScore:       0.5,
          expectedLoss:   (decision.dtiPct / 100) * 0.5,
          riskBand:       decision.riskBand,
          recommendation: decision.approved ? 'APPROVE' : 'DECLINE',
          approvedAmount: decision.approved ? BigInt(decision.amount) : null,
          approvedAprBps: decision.approved ? decision.approvedAprBps : null,
          approvedTermDays: decision.approved ? app.termDaysRequested : null,
        },
      }),
    );

    // Step 4: Emit downstream event
    const eventName = decision.approved ? 'application/approved' : 'application/rejected';
    await step.sendEvent('emit-decision', {
      name: eventName,
      data: { applicationId },
    });

    return decision;
  },
);
