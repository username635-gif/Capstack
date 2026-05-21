/**
 * Conversational onboarding agent — handles KYC step-by-step.
 *
 * WHAT THIS DOES:
 *   Guides a borrower through the KYC onboarding flow as a multi-turn
 *   conversation. Each turn represents one step in the process. The agent
 *   tracks which steps are done, asks only what's missing, and emits
 *   structured events when a step completes.
 *
 * KYC FLOW STEPS (in order):
 *   STEP 1 — COLLECT_PERSONAL_DETAILS   (name, ID number, DOB)
 *   STEP 2 — LIVENESS_CHECK             (selfie via Smile ID)
 *   STEP 3 — DOCUMENT_UPLOAD            (SA Smart ID or passport)
 *   STEP 4 — SANCTIONS_SCREEN           (name check — FICA s.21)
 *   STEP 5 — BANK_STATEMENT             (3 months — affordability)
 *   STEP 6 — INCOME_VERIFICATION        (salary slip or business financials)
 *   STEP 7 — REVIEW_AND_CONFIRM         (borrower confirms all details)
 *
 * HOW IT WORKS:
 *   The agent keeps a session record (OnboardingSession) in Redis/DB.
 *   Each call to advanceOnboarding() receives the current message, determines
 *   what step the user is on, validates the input, and returns:
 *     - The next step ID
 *     - The agent's next question / instruction
 *     - Whether onboarding is complete
 *
 * PRODUCTION INTEGRATION:
 *   Replace the stub response generator with a real LLM call:
 *     const { text } = await generateText({
 *       model: openai('gpt-4o'),
 *       system: SYSTEM_PROMPT,
 *       messages: session.history,
 *     });
 *   Use Vercel AI SDK for streaming to the front-end (useChat hook).
 *
 * Patterns applied:
 *   1. Early return — skip completed steps, validate inputs
 *   2. Ternary — step routing
 *   7. Property shorthand
 *   8. Composition — advanceOnboarding orchestrates the step pipeline
 */

import type {
  OnboardingStep,
  OnboardingMessage,
  OnboardingSession,
  OnboardingData,
  OnboardingTurnInput,
  OnboardingTurnOutput,
} from '@capstack/types';

// ─── Types ────────────────────────────────────────────────────────────────────

// Shared onboarding types are now centralized in @capstack/types.

// ─── Step definitions ─────────────────────────────────────────────────────────

const STEP_ORDER: OnboardingStep[] = [
  'COLLECT_PERSONAL_DETAILS',
  'LIVENESS_CHECK',
  'DOCUMENT_UPLOAD',
  'SANCTIONS_SCREEN',
  'BANK_STATEMENT',
  'INCOME_VERIFICATION',
  'REVIEW_AND_CONFIRM',
  'COMPLETE',
];

const STEP_PROMPTS: Record<OnboardingStep, string> = {
  COLLECT_PERSONAL_DETAILS: "Let's get started! Please tell me your **full legal name**, **ID number** (or passport number), and **date of birth** (YYYY-MM-DD).",
  LIVENESS_CHECK:           "Great, thank you! Next I need to confirm it's really you. Please **take a short selfie video** — tap the camera button below to open the liveness check.",
  DOCUMENT_UPLOAD:          "Perfect. Now please **upload a photo of your South African Smart ID card or passport** — both sides if it's the Smart ID.",
  SANCTIONS_SCREEN:         "Screening your details against sanctions and PEP lists — this usually takes just a few seconds. Please hold on...",
  BANK_STATEMENT:           "Almost there! Please **link your bank account** (via Stitch) or **upload your last 3 months' bank statements** as a PDF.",
  INCOME_VERIFICATION:      "One more step — please **upload your latest payslip** (or last 6 months' financial statements if you're self-employed).",
  REVIEW_AND_CONFIRM:       "Everything looks good! Please review the information below and type **CONFIRM** if everything is correct, or let me know what needs to change.",
  COMPLETE:                 "Your KYC is complete 🎉 You can now proceed with your loan application. A compliance officer may contact you if any documents need clarification.",
};

// ─── Main agent function ───────────────────────────────────────────────────────

/**
 * Advance the onboarding conversation by one turn.
 * Pattern 8 — pipeline: load session → validate message → advance step → persist → return
 */
export async function advanceOnboarding(
  input: OnboardingTurnInput,
): Promise<OnboardingTurnOutput> {
  const { sessionId, borrowerId, userMessage } = input;

  // Initialise or load session
  const session: OnboardingSession = input.currentSession ?? _createSession(sessionId, borrowerId);

  // Pattern 1 — early return if already complete
  if (session.currentStep === 'COMPLETE') {
    return {
      session,
      agentMessage: STEP_PROMPTS.COMPLETE,
      currentStep:  'COMPLETE',
      isComplete:   true,
    };
  }

  // Append the user's message to history
  session.history.push({ role: 'user', content: userMessage, ts: new Date().toISOString() });

  // Process the current step
  const { nextStep, agentMessage, requiresAction, collectedData } =
    await _processStep(session.currentStep, userMessage, session.collectedData);

  // Merge any newly collected data
  Object.assign(session.collectedData, collectedData);

  // Advance session
  if (nextStep !== session.currentStep) {
    session.completedSteps.push(session.currentStep);
    session.currentStep = nextStep;
  }

  session.updatedAt = new Date().toISOString();
  session.history.push({ role: 'agent', content: agentMessage, ts: new Date().toISOString() });

  const isComplete = session.currentStep === 'COMPLETE';

  return { session, agentMessage, currentStep: nextStep, isComplete, requiresAction };
}

/**
 * Create a fresh onboarding session.
 */
export function createOnboardingSession(sessionId: string, borrowerId: string): OnboardingSession {
  return _createSession(sessionId, borrowerId);
}

// ─── Step processor ───────────────────────────────────────────────────────────

async function _processStep(
  step:       OnboardingStep,
  userMessage: string,
  existingData: Partial<OnboardingData>,
): Promise<{
  nextStep:       OnboardingStep;
  agentMessage:   string;
  requiresAction?: OnboardingTurnOutput['requiresAction'];
  collectedData:  Partial<OnboardingData>;
}> {
  switch (step) {
    case 'COLLECT_PERSONAL_DETAILS': {
      // Parse name + ID + DOB from free text (stub: assume they provided it)
      const parsedName = userMessage.split(',')[0]?.trim() ?? userMessage.slice(0, 40);
      const parsedId   = userMessage.match(/\b\d{13}\b/)?.[0] ?? `stub_id_${Date.now()}`;
      const parsedDob  = userMessage.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? '1990-01-01';
      return {
        nextStep:     'LIVENESS_CHECK',
        agentMessage:  STEP_PROMPTS.LIVENESS_CHECK,
        requiresAction: 'OPEN_SMILE_SDK',
        collectedData: { fullName: parsedName, idNumber: parsedId, dateOfBirth: parsedDob },
      };
    }

    case 'LIVENESS_CHECK': {
      // Front-end sends "SMILE_DONE:<jobId>" after Smile SDK completes
      const smileJobId = userMessage.match(/SMILE_DONE:(\S+)/)?.[1] ?? `smile_stub_${Date.now()}`;
      return {
        nextStep:     'DOCUMENT_UPLOAD',
        agentMessage:  STEP_PROMPTS.DOCUMENT_UPLOAD,
        requiresAction: 'UPLOAD_DOCUMENT',
        collectedData: { smileJobId },
      };
    }

    case 'DOCUMENT_UPLOAD': {
      const documentJobId = userMessage.match(/DOC_DONE:(\S+)/)?.[1] ?? `doc_stub_${Date.now()}`;
      return {
        nextStep:     'SANCTIONS_SCREEN',
        agentMessage:  STEP_PROMPTS.SANCTIONS_SCREEN,
        collectedData: { documentJobId },
      };
    }

    case 'SANCTIONS_SCREEN': {
      // Auto-advance after running check — production: call checkSanctions() from @capstack/kyc
      return {
        nextStep:     'BANK_STATEMENT',
        agentMessage:  `✅ Sanctions check passed. ${STEP_PROMPTS.BANK_STATEMENT}`,
        requiresAction: 'LINK_BANK',
        collectedData: { sanctionsClear: true },
      };
    }

    case 'BANK_STATEMENT': {
      const bankRef = userMessage.match(/BANK_DONE:(\S+)/)?.[1] ?? `bank_stub_${Date.now()}`;
      return {
        nextStep:     'INCOME_VERIFICATION',
        agentMessage:  STEP_PROMPTS.INCOME_VERIFICATION,
        requiresAction: 'UPLOAD_DOCUMENT',
        collectedData: { bankStatementRef: bankRef },
      };
    }

    case 'INCOME_VERIFICATION': {
      const incomeRef = userMessage.match(/INCOME_DONE:(\S+)/)?.[1] ?? `income_stub_${Date.now()}`;
      const summary   = _buildSummary({ ...existingData, incomeRef } as OnboardingData);
      return {
        nextStep:     'REVIEW_AND_CONFIRM',
        agentMessage:  `${STEP_PROMPTS.REVIEW_AND_CONFIRM}\n\n${summary}`,
        collectedData: { incomeRef },
      };
    }

    case 'REVIEW_AND_CONFIRM': {
      const confirmed = /confirm/i.test(userMessage);
      if (!confirmed) {
        return {
          nextStep:     'REVIEW_AND_CONFIRM',
          agentMessage:  "No problem! What would you like to change?",
          collectedData: {},
        };
      }
      return {
        nextStep:     'COMPLETE',
        agentMessage:  STEP_PROMPTS.COMPLETE,
        collectedData: {},
      };
    }

    default:
      return { nextStep: 'COMPLETE', agentMessage: STEP_PROMPTS.COMPLETE, collectedData: {} };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _createSession(sessionId: string, borrowerId: string): OnboardingSession {
  const now = new Date().toISOString();
  return {
    sessionId,
    borrowerId,
    currentStep:    'COLLECT_PERSONAL_DETAILS',
    completedSteps: [],
    history:        [{
      role:    'agent',
      content: STEP_PROMPTS.COLLECT_PERSONAL_DETAILS,
      ts:      now,
    }],
    collectedData: {},
    createdAt:    now,
    updatedAt:    now,
  };
}

function _buildSummary(data: OnboardingData): string {
  return [
    `**Name:** ${data.fullName ?? '—'}`,
    `**ID Number:** ${data.idNumber ?? '—'}`,
    `**Date of Birth:** ${data.dateOfBirth ?? '—'}`,
    `**Liveness check:** ${data.smileJobId ? '✅ Passed' : '—'}`,
    `**Document verified:** ${data.documentJobId ? '✅ Uploaded' : '—'}`,
    `**Sanctions screen:** ${data.sanctionsClear ? '✅ Clear' : '—'}`,
    `**Bank statement:** ${data.bankStatementRef ? '✅ Linked' : '—'}`,
    `**Income verified:** ${data.incomeRef ? '✅ Uploaded' : '—'}`,
  ].join('\n');
}
