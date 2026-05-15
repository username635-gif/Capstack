/**
 * Collections AI agent stub.
 *
 * Decides the next collection action based on a loan's DPD and payment history.
 *
 * COLLECTION ACTION LADDER (aligned with NCR guidelines):
 *   0 DPD    — NONE: loan is current, no action needed
 *   1–3 DPD  — SMS_REMINDER: gentle nudge, borrower likely forgot
 *   4–14 DPD — EMAIL_REMINDER: escalate to email, flag in CRM
 *   15–30 DPD — CALL: telephonic contact required before NCA Section 129 notice
 *   31–60 DPD — RESTRUCTURE_OFFER: offer payment holiday or term extension to prevent NPL
 *   60+ DPD  — LEGAL: Section 129 notice, hand to collections attorney
 *
 * TO REPLACE WITH REAL LLM AGENT:
 *   Call an OpenAI function-calling model with the borrower's full history,
 *   past responses to collections attempts, and preferred contact channel.
 *   The model should return action + channel + message body.
 *   The current stub ignores payment history — a real agent would avoid
 *   calling borrowers who never answer and prefer SMS instead.
 *
 * Patterns applied:
 *   1. Early return — current loans need no collection action
 *   2. Ternary — action selection per DPD bucket
 *   7. Property shorthand
 *   8. Composition — pure function, chains with delinquency job output
 */

export interface CollectionInput {
  loanId:      string;
  borrowerId:  string;
  daysPastDue: number;
  outstanding: number;  // total outstanding in cents
}

export interface CollectionAction {
  loanId:   string;
  action:   'NONE' | 'SMS_REMINDER' | 'EMAIL_REMINDER' | 'CALL' | 'RESTRUCTURE_OFFER' | 'LEGAL';
  message:  string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

/**
 * Determine next collection action for a loan.
 * Pattern 8 — pure function; compose with updateDelinquency job
 */
export function collectionsAgent(input: CollectionInput): CollectionAction {
  const { loanId, daysPastDue } = input;

  // Pattern 1 — early return for current loans
  if (daysPastDue === 0) {
    return { loanId, action: 'NONE', message: 'Loan is current', priority: 'LOW' };
  }

  // Pattern 2 — ternary chain for action selection
  const action: CollectionAction['action'] =
    daysPastDue <= 3  ? 'SMS_REMINDER'       :
    daysPastDue <= 14 ? 'EMAIL_REMINDER'      :
    daysPastDue <= 30 ? 'CALL'                :
    daysPastDue <= 60 ? 'RESTRUCTURE_OFFER'   :
    'LEGAL';

  const priority: CollectionAction['priority'] =
    daysPastDue <= 3  ? 'LOW'      :
    daysPastDue <= 14 ? 'MEDIUM'   :
    daysPastDue <= 30 ? 'HIGH'     :
    'CRITICAL';

  const message = `Loan is ${daysPastDue} DPD. Recommended action: ${action}`;

  // Pattern 7 — shorthand
  return { loanId, action, message, priority };
}
