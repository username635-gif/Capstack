/**
 * Onfido KYC client — stub implementation.
 * Replace with real @onfido/api calls when credentials are provisioned.
 *
 * PRODUCTION INTEGRATION STEPS:
 *   1. Install SDK:  pnpm add @onfido/api --filter @capstack/kyc
 *   2. Set env vars: ONFIDO_API_TOKEN, ONFIDO_WEBHOOK_TOKEN
 *   3. Replace createApplicant() body with:
 *        const onfido = new Onfido({ apiToken: process.env.ONFIDO_API_TOKEN });
 *        return onfido.applicant.create({ firstName, lastName });
 *   4. Wire generateSdkToken() to the borrower's frontend (pass token to Onfido SDK)
 *   5. retrieveCheck() is called from the KYC webhook handler after Onfido posts results
 *
 * KYC FLOW (end-to-end):
 *   Borrower registers → createApplicant() → generateSdkToken() → frontend SDK
 *   → borrower submits ID + selfie → Onfido runs checks → webhook fires
 *   → retrieveCheck() → update BorrowerKyc record → allow/block application
 *
 * Patterns applied:
 *   1. Early return — validate inputs immediately
 *   7. Property shorthand
 */

export interface OnfidoApplicant {
  id: string;
  status: 'pending' | 'complete' | 'withdrawn';
}

export interface OnfidoCheck {
  id: string;
  applicantId: string;
  status: 'in_progress' | 'awaiting_applicant' | 'complete' | 'withdrawn';
  result?: 'clear' | 'consider';
}

export async function createApplicant(
  borrowerId: string,
  fullName: string,
  _email: string,
): Promise<OnfidoApplicant> {
  // Pattern 1 — early return on missing required field
  if (!borrowerId) throw new Error('borrowerId is required');

  const id = `onfido_${borrowerId}`;
  const status = 'pending' as const;
  // Pattern 7 — shorthand
  return { id, status };
}

export async function generateSdkToken(applicantId: string): Promise<string> {
  if (!applicantId) throw new Error('applicantId is required');
  return `sdk_token_${applicantId}_${Date.now()}`;
}

export async function retrieveCheck(checkId: string): Promise<OnfidoCheck> {
  // Stub: always returns clear result
  return {
    id:          checkId,
    applicantId: checkId.replace('check_', ''),
    status:      'complete',
    result:      'clear',
  };
}
