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

    // ── STEP 3: ML scoring (optional — falls back gracefully if service is down) ─
    // CREDIT_MODEL_URL must point to the FastAPI serving container, e.g.
    //   https://capstack-ml.railway.app  or  http://localhost:8000  in dev.
    // If unset or unreachable the rules-based decision is used unchanged.
    const mlScore = await step.run('ml-score', async () => {
      const modelUrl = process.env.CREDIT_MODEL_URL;
      if (!modelUrl) return null;

      const monthlyIncomeZar = Number(app.borrower.individual?.monthlyIncome ?? 0n) / 100;
      const payload = {
        income:            monthlyIncomeZar,
        dti:               Math.min(1, decision.dtiPct / 100),
        overdraft_count:   0,    // TODO: pull from credit bureau once integrated
        bureau_score:      650,  // TODO: pull from KYC check once bureau is wired
        employment_months: 12,   // TODO: pull from Borrower.individual.employmentMonths
      };

      try {
        const controller = new AbortController();
        const timeout    = setTimeout(() => controller.abort(), 5_000); // 5 s hard timeout
        const res = await fetch(`${modelUrl}/predict`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(payload),
          signal:  controller.signal,
        });
        clearTimeout(timeout);
        if (!res.ok) return null;
        return (await res.json()) as { pd: number; band: string; model_version: string };
      } catch {
        // Timeout, ECONNREFUSED, etc. — degrade gracefully rather than failing the job.
        return null;
      }
    });

    // Blend rule engine + ML:
    //   • ML can VETO an approval (pd ≥ 0.20 → band D/E → decline)
    //   • ML cannot override a rules hard-decline (NCA gates must still pass)
    //   • Falls back to pure rules when ML is unavailable (mlScore === null)
    const finalApproved  = decision.approved && (mlScore === null || mlScore.pd < 0.20);
    const finalPdScore   = mlScore !== null ? mlScore.pd : decision.dtiPct / 100;
    const finalBand      = mlScore !== null ? mlScore.band : decision.riskBand;
    const modelVersion   = mlScore !== null ? `rules-v1+${mlScore.model_version}` : 'rules-v1';

    // Step 4: Persist credit decision
    await step.run('persist-decision', () =>
      prisma.creditDecision.create({
        data: {
          applicationId,
          modelVersion,
          pdScore:        finalPdScore,
          lgdScore:       0.5,
          expectedLoss:   finalPdScore * 0.5,
          riskBand:       finalBand,
          recommendation: finalApproved ? 'APPROVE' : 'DECLINE',
          approvedAmount: finalApproved ? BigInt(decision.amount) : null,
          approvedAprBps: finalApproved ? decision.approvedAprBps : null,
          approvedTermDays: finalApproved ? app.termDaysRequested : null,
        },
      }),
    );

    // Step 5: Emit downstream event
    const eventName = finalApproved ? 'application/approved' : 'application/rejected';
    await step.sendEvent('emit-decision', {
      name: eventName,
      data: { applicationId },
    });

    return { ...decision, finalApproved, finalPdScore, finalBand, modelVersion };
  },
);
