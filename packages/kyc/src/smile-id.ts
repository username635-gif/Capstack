/**
 * Smile ID — alternative biometric KYC provider for Africa.
 *
 * WHY SMILE ID:
 *   Onfido is strong globally but Smile ID is purpose-built for African ID
 *   documents (South African Smart ID, SA Driver's License, Nigerian NIN/BVN,
 *   Kenyan Huduma, Ghana Card, etc.). Its liveness detection is tuned for
 *   African skin tones, giving better pass rates without sacrificing fraud
 *   prevention. Use Smile ID as the primary KYC provider OR as a fallback
 *   when Onfido declines a document it can't read.
 *
 * PRODUCTS USED:
 *   - SmartSelfie™ Authentication — facial liveness check
 *   - DocV            — document verification (SA Smart ID, passports)
 *   - ID API          — real-time national ID number validation against gov DB
 *   - Business Verification — CIPC registration check (complements KYB)
 *
 * PRODUCTION INTEGRATION STEPS:
 *   1. Sign up at https://portal.smileidentity.com
 *   2. Set env vars: SMILE_ID_PARTNER_ID, SMILE_ID_API_KEY, SMILE_ID_SID_SERVER
 *   3. Install SDK: pnpm add @smileid/server-sdk --filter @capstack/kyc
 *   4. Replace stub bodies — SmileIdentity.ID_API.submit_job()
 *   5. Handle webhook: Smile ID POSTs results to /api/v1/webhooks/kyc when done
 *
 * Patterns applied:
 *   1. Early return — validate inputs
 *   7. Property shorthand
 *   8. Composition — submitJob orchestrates the SmileIdentity pipeline
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type SmileJobType =
  | 'SMART_SELFIE_AUTHENTICATION'   // liveness + face match
  | 'DOCUMENT_VERIFICATION'          // ID document OCR + authenticity
  | 'ID_API'                         // real-time national DB lookup
  | 'BUSINESS_VERIFICATION';         // CIPC check

export interface SmileJobInput {
  partnerId:   string;   // Capstack's Smile ID Partner ID
  borrowerId:  string;
  jobType:     SmileJobType;
  idNumber?:   string;
  idType?:     'NATIONAL_ID' | 'PASSPORT' | 'DRIVERS_LICENSE' | 'BVN';
  countryCode: string;   // ISO 2-letter, e.g. "ZA"
  firstName?:  string;
  lastName?:   string;
  dob?:        string;   // YYYY-MM-DD
}

export type SmileJobStatus = 'Submitted' | 'Complete' | 'Failed' | 'ManualReview';

export interface SmileJobResult {
  jobId:        string;
  borrowerId:   string;
  jobType:      SmileJobType;
  status:       SmileJobStatus;
  resultCode:   string;  // "0810" = pass, "0811" = fail, per Smile ID result codes
  resultText:   string;
  confidence?:  number;  // 0-100 face match confidence for SMART_SELFIE
  actions?: {
    selfieConfirmed:  string;
    humanReviewNeeded: boolean;
  };
}

// ─── Implementation (stub) ────────────────────────────────────────────────────

/**
 * Submit a Smile ID job for identity verification.
 *
 * Job types:
 *   - SMART_SELFIE_AUTHENTICATION: borrower takes a selfie, system validates liveness + match
 *   - DOCUMENT_VERIFICATION: scan SA Smart ID / passport for OCR + tamper detection
 *   - ID_API: instant national ID number lookup against South African Home Affairs DB
 *
 * Pattern 8 — pipeline: validate → submit → poll result
 */
export async function submitSmileJob(input: SmileJobInput): Promise<SmileJobResult> {
  // Pattern 1 — early return on missing fields
  if (!input.borrowerId || !input.countryCode) {
    throw new Error('submitSmileJob: borrowerId and countryCode are required');
  }

  // Production: call SmileIdentity SDK
  //   const SmileIdentity = require('@smileid/server-sdk');
  //   const connection     = new SmileIdentity(process.env.SMILE_ID_PARTNER_ID, process.env.SMILE_ID_API_KEY, process.env.SMILE_ID_SID_SERVER);
  //   const result = await connection.submit_job(partner_params, id_info, images, options);

  const jobId = `smile_${input.borrowerId}_${Date.now()}`;

  // Stub result — simulates a successful pass
  return {
    jobId,
    borrowerId:  input.borrowerId,
    jobType:     input.jobType,
    status:      'Complete',
    resultCode:  '0810',   // 0810 = Passed
    resultText:  'Verified',
    confidence:  input.jobType === 'SMART_SELFIE_AUTHENTICATION' ? 98.4 : undefined,
    actions: {
      selfieConfirmed:   'Passed',
      humanReviewNeeded: false,
    },
  };
}

/**
 * Validate a South African ID number using Smile ID's real-time ID API.
 * Checks the number against the Department of Home Affairs database.
 *
 * Pattern 1 — early return on format mismatch.
 */
export async function validateSaIdNumber(
  borrowerId: string,
  idNumber:   string,
): Promise<SmileJobResult> {
  // SA ID numbers are exactly 13 digits
  if (!/^\d{13}$/.test(idNumber)) {
    throw new Error('validateSaIdNumber: South African ID must be exactly 13 digits');
  }

  return submitSmileJob({
    partnerId:   process.env.SMILE_ID_PARTNER_ID ?? '',
    borrowerId,
    jobType:     'ID_API',
    idNumber,
    idType:      'NATIONAL_ID',
    countryCode: 'ZA',
  });
}

/**
 * Run a biometric liveness check — borrower takes a selfie and blinks.
 * Returns confidence score for face match against their ID document.
 */
export async function runLivenessCheck(
  borrowerId: string,
  countryCode = 'ZA',
): Promise<SmileJobResult> {
  return submitSmileJob({
    partnerId:   process.env.SMILE_ID_PARTNER_ID ?? '',
    borrowerId,
    jobType:     'SMART_SELFIE_AUTHENTICATION',
    countryCode,
  });
}
