/**
 * @package @capstack/ai
 *
 * AI / LLM integration stubs for the Capstack platform.
 *
 * STATUS: STUB — all functions return placeholder data.
 *   Wire up to a real LLM provider when ready.
 *
 * PLANNED INTEGRATIONS:
 *   - OpenAI GPT-4o (credit narrative generation, document summarisation)
 *   - Anthropic Claude (complex reasoning, compliance explanations)
 *   - Vercel AI SDK (streaming responses to the front-end)
 *
 * HOW TO WIRE UP (example with OpenAI):
 *   1. pnpm add openai --filter @capstack/ai
 *   2. Add OPENAI_API_KEY to the relevant .env file
 *   3. Replace the stub body in generateCreditNarrative() with real API calls
 *
 * AGENT RUNS:
 *   The database has an AgentRun table for auditing all LLM calls.
 *   When implementing, persist each call via @capstack/db prisma.agentRun.create().
 */

// ─── LLM / AI Stubs ───────────────────────────────────────────────────────────

export interface CreditNarrativeInput {
  borrowerId: string;
  applicationId: string;
  bureauScore?: number;
  incomeMonthly?: number;
  requestedAmount: number;
  termDays: number;
}

export interface CreditNarrative {
  summary: string;
  riskFactors: string[];
  recommendation: 'APPROVE' | 'DECLINE' | 'REFER';
  confidence: number;
}

export interface AgentRunResult {
  agentId: string;
  runId: string;
  output: string;
  tokensUsed: number;
  durationMs: number;
}

/**
 * Generate a credit narrative using an LLM.
 * TODO: Wire up to OpenAI / Anthropic / local model.
 */
export async function generateCreditNarrative(
  _input: CreditNarrativeInput
): Promise<CreditNarrative> {
  // Stub — return a static narrative
  return {
    summary: 'Stub: Credit narrative not yet implemented.',
    riskFactors: [],
    recommendation: 'REFER',
    confidence: 0,
  };
}

/**
 * Run an AI agent for a given task.
 * TODO: Wire up to an agent framework (e.g. LangChain, Vercel AI SDK).
 */
export async function runAgent(
  _agentId: string,
  _input: Record<string, unknown>
): Promise<AgentRunResult> {
  return {
    agentId: _agentId,
    runId: `stub_${Date.now()}`,
    output: 'Stub: Agent not yet implemented.',
    tokensUsed: 0,
    durationMs: 0,
  };
}
