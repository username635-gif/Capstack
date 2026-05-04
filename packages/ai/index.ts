// ─── LLM / AI Stubs ───────────────────────────────────────────────────────────
// Placeholder interfaces and stubs for AI/LLM integrations.
// Wire up to OpenAI, Anthropic, or local models in future.

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
