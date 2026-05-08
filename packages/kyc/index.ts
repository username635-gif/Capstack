/**
 * @package @capstack/kyc
 *
 * KYC (Know Your Customer) and AML (Anti-Money Laundering) stubs.
 *
 * STATUS: STUB — all functions return placeholder data.
 *   Wire up to Onfido (or alternative) when credentials are available.
 *
 * PLANNED INTEGRATION: Onfido
 *   - Docs: https://documentation.onfido.com
 *   - Required env vars: ONFIDO_API_TOKEN
 *   - SDK:  pnpm add @onfido/api --filter @capstack/kyc
 *
 * KYC FLOW:
 *   1. Call initiateKycCheck() when a borrower submits their application.
 *   2. Onfido performs document + facial biometric checks asynchronously.
 *   3. Onfido sends a webhook (POST /api/v1/webhooks/kyc) with the result.
 *   4. Call getKycCheckResult() to retrieve and store the final status.
 *   5. Update KycCheck record in database via @capstack/db.
 *
 * AML FLOW:
 *   - Call runAmlCheck() before approving any loan.
 *   - Check isPep and isSanctioned; escalate to compliance team if true.
 *   - Store result in AmlAlert table via @capstack/db.
 *
 * REGULATORY REQUIREMENT:
 *   All KYC/AML records must be retained for at least 5 years (FICA, South Africa).
 */

// ─── KYC / Identity Verification Stubs ───────────────────────────────────────

export type KycStatus = 'PENDING' | 'APPROVED' | 'DECLINED' | 'REFERRED' | 'ERROR';

export interface KycCheckInput {
  borrowerId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string; // ISO 8601 YYYY-MM-DD
  countryCode: string; // ISO 3166-1 alpha-2
  documentType: 'PASSPORT' | 'NATIONAL_ID' | 'DRIVERS_LICENSE';
}

export interface KycCheckResult {
  checkId: string;
  borrowerId: string;
  status: KycStatus;
  provider: string;
  rawResult?: Record<string, unknown>;
  createdAt: Date;
}

export interface AmlCheckResult {
  checkId: string;
  borrowerId: string;
  isPep: boolean;   // Politically Exposed Person
  isSanctioned: boolean;
  riskScore: number; // 0-100
  provider: string;
  createdAt: Date;
}

/**
 * Initiate an identity check via Onfido.
 * TODO: Wire up to Onfido API (https://documentation.onfido.com).
 */
export async function initiateKycCheck(
  input: KycCheckInput
): Promise<KycCheckResult> {
  return {
    checkId: `stub_kyc_${Date.now()}`,
    borrowerId: input.borrowerId,
    status: 'PENDING',
    provider: 'stub',
    createdAt: new Date(),
  };
}

/**
 * Retrieve the result of a previously initiated KYC check.
 */
export async function getKycCheckResult(
  checkId: string,
  borrowerId: string
): Promise<KycCheckResult> {
  return {
    checkId,
    borrowerId,
    status: 'APPROVED',
    provider: 'stub',
    createdAt: new Date(),
  };
}

/**
 * Run an AML (Anti-Money Laundering) screening.
 * TODO: Wire up to Onfido Watchlist or similar.
 */
export async function runAmlCheck(
  borrowerId: string,
  _fullName: string
): Promise<AmlCheckResult> {
  return {
    checkId: `stub_aml_${Date.now()}`,
    borrowerId,
    isPep: false,
    isSanctioned: false,
    riskScore: 0,
    provider: 'stub',
    createdAt: new Date(),
  };
}

// ── Onfido & sanctions implementations ───────────────────────────────────────
export { createApplicant, generateSdkToken, retrieveCheck } from './src/onfido';
export type { OnfidoApplicant, OnfidoCheck } from './src/onfido';
export { checkSanctions } from './src/sanctions';
export type { SanctionsResult } from './src/sanctions';

