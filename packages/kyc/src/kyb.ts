/**
 * KYB (Know Your Business) pipeline stub.
 *
 * Verifies that a business entity is legitimately registered, is not a shell
 * company, and that its UBOs (Ultimate Beneficial Owners) pass individual KYC.
 *
 * WHY KYB EXISTS (separate from KYC):
 *   FICAA s.9 and the Companies Act require lenders to verify business
 *   registration, director identities, and UBO chains before extending credit.
 *   Failure exposes the lender to criminal liability for facilitating fraud.
 *
 * WHAT IT CHECKS:
 *   1. Company registration validity (CIPC — Companies and Intellectual
 *      Property Commission, South Africa).
 *   2. Director / signatory identity (individual KYC for each director).
 *   3. UBO chain — who ultimately owns or controls ≥ 25% of the entity.
 *   4. Business sanctions screening (same OFAC / UN / EU lists as individuals).
 *
 * PRODUCTION INTEGRATION OPTIONS:
 *   - Onfido KYB (https://onfido.com/kyb/)
 *   - ComplyAdvantage Business (https://complyadvantage.com)
 *   - Trulioo Business (https://trulioo.com)
 *   - CIPC direct API for South African company lookups
 *
 * INTEGRATION STEPS:
 *   1. pnpm add @onfido/api --filter @capstack/kyc (already added for KYC)
 *   2. Set env: ONFIDO_WORKFLOW_RUN_ID for the KYB workflow
 *   3. Replace stub bodies with real provider calls
 *   4. Wire verifyBusiness() into POST /api/v1/borrowers when type = 'BUSINESS'
 *   5. Store result in KycCheck with type = 'BUSINESS_VERIFICATION'
 *
 * Patterns applied:
 *   1. Early return — validate required fields
 *   7. Property shorthand
 *   8. Composition — verifyBusiness orchestrates sub-checks as a pipeline
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BusinessInput {
  borrowerId:          string;
  registrationNumber:  string;   // e.g. "2020/123456/07" — South African CIPC format
  registeredName:      string;
  tradingName?:        string;
  countryCode:         string;   // ISO 3166-1 alpha-2, e.g. "ZA"
  directors:           DirectorInput[];
}

export interface DirectorInput {
  fullName:    string;
  idNumber:    string;            // South African ID number or passport
  nationality: string;
  ownershipPct: number;           // 0–100
}

export type KybStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'DECLINED'
  | 'REFERRED'
  | 'MANUAL_REVIEW_REQUIRED';

export interface KybResult {
  checkId:              string;
  borrowerId:           string;
  status:               KybStatus;
  registrationValid:    boolean;
  directorsVerified:    number;     // count of directors with cleared individual KYC
  directorsTotal:       number;
  uboClearCount:        number;
  sanctionsHit:         boolean;
  provider:             string;
  notes?:               string;
}

// ─── Implementation (stub) ────────────────────────────────────────────────────

/**
 * Verify a business entity and its UBO chain.
 * Pattern 8 — pipeline: validate → check registration → check directors → aggregate
 */
export async function verifyBusiness(input: BusinessInput): Promise<KybResult> {
  // Pattern 1 — early return on missing required fields
  if (!input.borrowerId || !input.registrationNumber || !input.directors.length) {
    throw new Error('verifyBusiness: borrowerId, registrationNumber, and at least one director are required');
  }

  // Step 1: Check company registration (CIPC stub)
  const registrationValid = await _checkCipcRegistration(
    input.registrationNumber,
    input.countryCode,
  );

  // Step 2: Screen each director individually
  const directorResults = await Promise.all(
    input.directors.map(d => _verifyDirector(d)),
  );
  const directorsVerified = directorResults.filter(r => r.cleared).length;
  const uboClearCount      = directorResults.filter(r => r.cleared && r.ownershipPct >= 25).length;
  const sanctionsHit       = directorResults.some(r => r.sanctionsHit);

  // Step 3: Determine overall status
  const allDirectorsClear = directorsVerified === input.directors.length;
  const status: KybStatus = !registrationValid
    ? 'DECLINED'
    : sanctionsHit
      ? 'DECLINED'
      : !allDirectorsClear
        ? 'MANUAL_REVIEW_REQUIRED'
        : 'APPROVED';

  const checkId = `kyb_${input.borrowerId}_${Date.now()}`;

  // Pattern 7 — shorthand
  return {
    checkId,
    borrowerId:        input.borrowerId,
    status,
    registrationValid,
    directorsVerified,
    directorsTotal:    input.directors.length,
    uboClearCount,
    sanctionsHit,
    provider:          'stub',
    notes:             status === 'APPROVED' ? undefined : `Review required: ${status}`,
  };
}

/**
 * Verify a single company registration against CIPC records.
 * Stub always returns valid — replace with real CIPC API call.
 */
async function _checkCipcRegistration(
  registrationNumber: string,
  countryCode: string,
): Promise<boolean> {
  // Production: GET https://api.cipc.co.za/v1/companies/{registrationNumber}
  // Check status === 'REGISTERED' and not deregistered/dissolved.
  void registrationNumber;
  void countryCode;
  return true; // stub: always valid
}

interface DirectorVerificationResult {
  fullName:     string;
  cleared:      boolean;
  sanctionsHit: boolean;
  ownershipPct: number;
}

/**
 * Run individual KYC + sanctions check for a director / UBO.
 * In production wire this to Onfido's workflow for individual checks.
 */
async function _verifyDirector(director: DirectorInput): Promise<DirectorVerificationResult> {
  // Stub — all directors are clear
  return {
    fullName:     director.fullName,
    cleared:      true,
    sanctionsHit: false,
    ownershipPct: director.ownershipPct,
  };
}
