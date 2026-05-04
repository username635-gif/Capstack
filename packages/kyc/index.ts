// ─── KYC / Identity Verification Stubs ───────────────────────────────────────
// Placeholder interfaces and stubs for Onfido (or similar) KYC integration.
// Replace stub implementations with real API calls when credentials are available.

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
