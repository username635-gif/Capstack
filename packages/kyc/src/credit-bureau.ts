/**
 * Credit bureau soft pull — Experian / TransUnion stub.
 *
 * WHY SOFT PULL:
 *   A soft inquiry does NOT affect the borrower's credit score.
 *   NCA Section 68 requires a lender to perform a credit bureau check before
 *   granting credit. The borrower must consent (Consent.scope = 'BUREAU')
 *   before this call is made.
 *
 * PRODUCTION INTEGRATION OPTIONS:
 *   - Experian South Africa:  https://www.experian.co.za — dominant SA bureau
 *   - TransUnion SA:          https://www.transunion.co.za
 *   - Compuscan (now Experian): merged into Experian SA in 2020
 *   - XDS:                    https://www.xds.co.za — NCR-registered bureau
 *
 * INTEGRATION STEPS (Experian SA):
 *   1. Register as an NCR credit provider — required before bureau access is granted.
 *   2. Contact Experian SA to obtain API credentials via their Business Connect portal.
 *   3. Set env vars: EXPERIAN_CLIENT_ID, EXPERIAN_CLIENT_SECRET, EXPERIAN_BASE_URL
 *   4. Replace stub bodies with real OAuth + REST calls.
 *   5. Wire performSoftPull() into the underwriting step ('load-application') in
 *      apps/workers/src/inngest/functions/underwrite.ts.
 *
 * SCORE BANDS (South African VantageScore equivalent):
 *   < 560   Poor     — high default risk
 *   560–619 Below average
 *   620–679 Fair
 *   680–749 Good
 *   750+    Excellent
 *
 * DATA RETURNED:
 *   bureauScore     — primary credit score (0–999 in SA bureau systems)
 *   defaultCount    — number of listed defaults in last 5 years
 *   judgementCount  — number of court judgements
 *   enquiryCount    — number of credit enquiries in last 12 months
 *   currentAccounts — open credit accounts with outstanding balances
 *   paymentHistory  — monthly payment status per account (0 = paid, 1–9 = months in arrears)
 *
 * Patterns applied:
 *   1. Early return — missing consent blocks the check (legal requirement)
 *   3. Nullish coalescing — safe env var access
 *   6. to() helper — surface errors as values
 *   7. Property shorthand
 *   8. Composition — performSoftPull → classifyRiskBand → pricing pipeline
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SoftPullInput {
  borrowerId:    string;
  idNumber:      string;    // SA 13-digit ID (must match borrower record)
  firstName:     string;
  lastName:      string;
  consentGranted: boolean;  // must be true; caller ensures Consent record exists
}

export interface CreditAccount {
  accountType:    string;   // CREDIT_CARD, PERSONAL_LOAN, HOME_LOAN, etc.
  lender:         string;
  outstandingBalance: number; // Rands
  monthlyPayment: number;
  arrearsMonths:  number;   // 0 = current
  openedDate:     string;   // YYYY-MM-DD
}

export interface SoftPullResult {
  borrowerId:      string;
  bureauScore:     number;    // 0–999; higher is better
  scoreDate:       string;    // ISO 8601 date of score calculation
  defaultCount:    number;    // listed defaults on file
  judgementCount:  number;    // civil court judgements
  enquiryCount:    number;    // credit enquiries in last 12 months
  currentAccounts: CreditAccount[];
  totalExposure:   number;    // sum of outstanding balances (Rands)
  monthlyObligations: number; // sum of all monthly repayments (Rands)
  provider:        string;    // 'EXPERIAN' | 'TRANSUNION' | 'XDS' | 'stub'
  rawResponse?:    Record<string, unknown>;
}

export type BureauMode = 'mock' | 'live';
export type BureauProvider = 'EXPERIAN' | 'TRANSUNION' | 'XDS' | 'MOCK';

type BureauConfig = {
  mode: BureauMode;
  provider: BureauProvider;
  baseUrl: string | null;
  authPath: string | null;
  enquiryPath: string | null;
  clientId: string | null;
  clientSecret: string | null;
  apiKey: string | null;
  apiKeyHeader: string;
  providerLabel: string;
};

// ─── Helper ───────────────────────────────────────────────────────────────────

async function to<T>(p: Promise<T>): Promise<[Error, null] | [null, T]> {
  try {
    return [null, await p];
  } catch (err) {
    return [err instanceof Error ? err : new Error(String(err)), null];
  }
}

function _getBureauConfig(): BureauConfig {
  const mode = (process.env.BUREAU_MODE ?? 'mock').toLowerCase() === 'live' ? 'live' : 'mock';
  const requestedProvider = (process.env.BUREAU_PROVIDER ?? 'EXPERIAN').toUpperCase();

  if (mode === 'mock') {
    return {
      mode,
      provider: 'MOCK',
      baseUrl: null,
      authPath: null,
      enquiryPath: null,
      clientId: null,
      clientSecret: null,
      apiKey: null,
      apiKeyHeader: 'x-api-key',
      providerLabel: `MOCK_${requestedProvider}`,
    };
  }

  if (requestedProvider === 'TRANSUNION') {
    return {
      mode,
      provider: 'TRANSUNION',
      baseUrl: process.env.TRANSUNION_BASE_URL ?? null,
      authPath: process.env.TRANSUNION_AUTH_PATH ?? null,
      enquiryPath: process.env.TRANSUNION_SOFT_PULL_PATH ?? null,
      clientId: process.env.TRANSUNION_CLIENT_ID ?? null,
      clientSecret: process.env.TRANSUNION_CLIENT_SECRET ?? null,
      apiKey: process.env.TRANSUNION_API_KEY ?? null,
      apiKeyHeader: process.env.TRANSUNION_API_KEY_HEADER ?? 'x-api-key',
      providerLabel: 'TRANSUNION',
    };
  }

  if (requestedProvider === 'XDS') {
    return {
      mode,
      provider: 'XDS',
      baseUrl: process.env.XDS_BASE_URL ?? null,
      authPath: process.env.XDS_AUTH_PATH ?? null,
      enquiryPath: process.env.XDS_SOFT_PULL_PATH ?? null,
      clientId: process.env.XDS_CLIENT_ID ?? null,
      clientSecret: process.env.XDS_CLIENT_SECRET ?? null,
      apiKey: process.env.XDS_API_KEY ?? null,
      apiKeyHeader: process.env.XDS_API_KEY_HEADER ?? 'x-api-key',
      providerLabel: 'XDS',
    };
  }

  return {
    mode,
    provider: 'EXPERIAN',
    baseUrl: process.env.EXPERIAN_BASE_URL ?? null,
    authPath: process.env.EXPERIAN_AUTH_PATH ?? '/oauth/token',
    enquiryPath: process.env.EXPERIAN_SOFT_PULL_PATH ?? '/v1/credit-report/soft-pull',
    clientId: process.env.EXPERIAN_CLIENT_ID ?? null,
    clientSecret: process.env.EXPERIAN_CLIENT_SECRET ?? null,
    apiKey: process.env.EXPERIAN_API_KEY ?? null,
    apiKeyHeader: process.env.EXPERIAN_API_KEY_HEADER ?? 'x-api-key',
    providerLabel: 'EXPERIAN',
  };
}

function _joinUrl(baseUrl: string, path: string): string {
  return new URL(path, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`).toString();
}

function _coerceObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function _getPath(source: unknown, path: readonly string[]): unknown {
  let current: unknown = source;
  for (const segment of path) {
    const objectValue = _coerceObject(current);
    if (!objectValue || !(segment in objectValue)) {
      return null;
    }

    current = objectValue[segment];
  }

  return current;
}

function _pickNumber(source: unknown, paths: ReadonlyArray<readonly string[]>): number | null {
  for (const path of paths) {
    const value = _getPath(source, path);
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }
  return null;
}

function _pickString(source: unknown, paths: ReadonlyArray<readonly string[]>): string | null {
  for (const path of paths) {
    const value = _getPath(source, path);
    if (typeof value === 'string' && value.trim() !== '') {
      return value;
    }
  }
  return null;
}

function _pickArray(source: unknown, paths: ReadonlyArray<readonly string[]>): unknown[] {
  for (const path of paths) {
    const value = _getPath(source, path);
    if (Array.isArray(value)) {
      return value;
    }
  }
  return [];
}

function _mapAccount(rawAccount: unknown): CreditAccount | null {
  const account = _coerceObject(rawAccount);
  if (!account) {
    return null;
  }

  return {
    accountType: _pickString(account, [['accountType'], ['type'], ['productType']]) ?? 'UNKNOWN',
    lender: _pickString(account, [['lender'], ['provider'], ['creditProvider'], ['institution']]) ?? 'Unknown bureau account',
    outstandingBalance: _pickNumber(account, [['outstandingBalance'], ['balance'], ['currentBalance'], ['amountOutstanding']]) ?? 0,
    monthlyPayment: _pickNumber(account, [['monthlyPayment'], ['installment'], ['repaymentAmount'], ['minimumPayment']]) ?? 0,
    arrearsMonths: _pickNumber(account, [['arrearsMonths'], ['monthsInArrears'], ['paymentHistory', 'arrearsMonths']]) ?? 0,
    openedDate: _pickString(account, [['openedDate'], ['openDate'], ['accountOpenedAt']]) ?? new Date().toISOString().slice(0, 10),
  };
}

function _mapLiveResponse(
  borrowerId: string,
  providerLabel: string,
  rawResponse: unknown,
): SoftPullResult {
  const rawObject = _coerceObject(rawResponse) ?? { rawResponse };
  const currentAccounts = _pickArray(rawObject, [
    ['currentAccounts'],
    ['accounts'],
    ['tradeLines'],
    ['report', 'accounts'],
    ['report', 'tradeLines'],
  ])
    .map(_mapAccount)
    .filter((account): account is CreditAccount => account !== null);

  const totalExposure = _pickNumber(rawObject, [
    ['totalExposure'],
    ['summary', 'totalExposure'],
    ['report', 'summary', 'totalExposure'],
  ]) ?? currentAccounts.reduce((sum, account) => sum + account.outstandingBalance, 0);

  const monthlyObligations = _pickNumber(rawObject, [
    ['monthlyObligations'],
    ['summary', 'monthlyObligations'],
    ['report', 'summary', 'monthlyObligations'],
  ]) ?? currentAccounts.reduce((sum, account) => sum + account.monthlyPayment, 0);

  return {
    borrowerId,
    bureauScore: _pickNumber(rawObject, [
      ['bureauScore'],
      ['score'],
      ['scoreValue'],
      ['creditScore'],
      ['summary', 'bureauScore'],
      ['report', 'summary', 'bureauScore'],
    ]) ?? 0,
    scoreDate: _pickString(rawObject, [
      ['scoreDate'],
      ['reportDate'],
      ['generatedAt'],
      ['summary', 'scoreDate'],
    ]) ?? new Date().toISOString().slice(0, 10),
    defaultCount: _pickNumber(rawObject, [
      ['defaultCount'],
      ['defaults'],
      ['summary', 'defaultCount'],
      ['report', 'summary', 'defaultCount'],
    ]) ?? 0,
    judgementCount: _pickNumber(rawObject, [
      ['judgementCount'],
      ['judgments'],
      ['judgements'],
      ['summary', 'judgementCount'],
      ['report', 'summary', 'judgementCount'],
    ]) ?? 0,
    enquiryCount: _pickNumber(rawObject, [
      ['enquiryCount'],
      ['inquiryCount'],
      ['enquiries'],
      ['summary', 'enquiryCount'],
      ['report', 'summary', 'enquiryCount'],
    ]) ?? 0,
    currentAccounts,
    totalExposure,
    monthlyObligations,
    provider: providerLabel,
    rawResponse: rawObject,
  };
}

async function _fetchAccessToken(config: BureauConfig): Promise<string | null> {
  if (!config.baseUrl || !config.authPath) {
    return null;
  }

  if (!config.clientId || !config.clientSecret) {
    return null;
  }

  const [authErr, response] = await to(
    fetch(_joinUrl(config.baseUrl, config.authPath), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }),
    }),
  );
  if (authErr) {
    throw authErr;
  }

  if (!response!.ok) {
    throw new Error(`Bureau auth failed with status ${response!.status}`);
  }

  const authPayload = await response!.json() as Record<string, unknown>;
  const accessToken = _pickString(authPayload, [['access_token'], ['token'], ['data', 'access_token']]);
  if (!accessToken) {
    throw new Error('Bureau auth succeeded but returned no access token');
  }

  return accessToken;
}

async function _performLiveSoftPull(input: SoftPullInput, config: BureauConfig): Promise<SoftPullResult> {
  if (!config.baseUrl || !config.enquiryPath) {
    throw new Error(`performSoftPull: ${config.providerLabel} live mode requires base URL and enquiry path`);
  }

  const accessToken = await _fetchAccessToken(config);
  if (!accessToken && !config.apiKey) {
    throw new Error(`performSoftPull: ${config.providerLabel} live mode requires OAuth credentials or API key`);
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  } else if (config.apiKey) {
    headers[config.apiKeyHeader] = config.apiKey;
  }

  const [pullErr, response] = await to(
    fetch(_joinUrl(config.baseUrl, config.enquiryPath), {
      method: 'POST',
      headers,
      body: JSON.stringify({
        borrowerId: input.borrowerId,
        idNumber: input.idNumber,
        firstName: input.firstName,
        lastName: input.lastName,
        enquiryType: 'SOFT',
      }),
    }),
  );
  if (pullErr) {
    throw pullErr;
  }

  if (!response!.ok) {
    const body = await response!.text();
    throw new Error(`Bureau soft pull failed with status ${response!.status}: ${body.slice(0, 200)}`);
  }

  const rawResponse = await response!.json();
  return _mapLiveResponse(input.borrowerId, config.providerLabel, rawResponse);
}

function _performMockSoftPull(input: SoftPullInput, providerLabel: string): SoftPullResult {
  const lastDigit = parseInt(input.idNumber[12] ?? '0', 10);
  const bureauScore = lastDigit % 2 === 0 ? 720 : 610;

  const stubAccounts: CreditAccount[] = [
    {
      accountType: 'PERSONAL_LOAN',
      lender: 'Stub Bank',
      outstandingBalance: 15000,
      monthlyPayment: 950,
      arrearsMonths: 0,
      openedDate: '2023-06-01',
    },
  ];

  const totalExposure = stubAccounts.reduce((sum, account) => sum + account.outstandingBalance, 0);
  const monthlyObligations = stubAccounts.reduce((sum, account) => sum + account.monthlyPayment, 0);

  return {
    borrowerId: input.borrowerId,
    bureauScore,
    scoreDate: new Date().toISOString().slice(0, 10),
    defaultCount: 0,
    judgementCount: 0,
    enquiryCount: 2,
    currentAccounts: stubAccounts,
    totalExposure,
    monthlyObligations,
    provider: providerLabel,
  };
}

// ─── Implementation (stub — replace with real bureau call) ───────────────────

/**
 * Perform a soft credit pull from the credit bureau.
 *
 * Pattern 1 — early return if consent not granted.
 * Pattern 8 — composition: auth → enquiry → map response
 */
export async function performSoftPull(input: SoftPullInput): Promise<SoftPullResult> {
  // Pattern 1 — legal gate: consent is a hard requirement under NCA s.68
  if (!input.consentGranted) {
    throw new Error('performSoftPull: borrower consent is required before bureau enquiry (NCA s.68)');
  }

  if (!input.borrowerId || !input.idNumber) {
    throw new Error('performSoftPull: borrowerId and idNumber are required');
  }

  const config = _getBureauConfig();

  // Production: authenticate then query
  //
  //   const baseUrl = process.env.EXPERIAN_BASE_URL ?? 'https://api.experian.co.za';
  //
  //   // Step 1 — obtain OAuth access token (client-credentials flow)
  //   const [authErr, token] = await to(
  //     fetch(`${baseUrl}/oauth/token`, {
  //       method: 'POST',
  //       headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  //       body: new URLSearchParams({
  //         grant_type:    'client_credentials',
  //         client_id:     process.env.EXPERIAN_CLIENT_ID  ?? '',
  //         client_secret: process.env.EXPERIAN_CLIENT_SECRET ?? '',
  //       }),
  //     }).then(r => r.json()),
  //   );
  //   if (authErr || !token?.access_token) throw new Error('Bureau auth failed');
  //
  //   // Step 2 — submit soft enquiry
  //   const [enquiryErr, raw] = await to(
  //     fetch(`${baseUrl}/v1/credit-report/soft-pull`, {
  //       method: 'POST',
  //       headers: {
  //         'Authorization': `Bearer ${token.access_token}`,
  //         'Content-Type': 'application/json',
  //       },
  //       body: JSON.stringify({
  //         idNumber:  input.idNumber,
  //         firstName: input.firstName,
  //         lastName:  input.lastName,
  //         enquiryType: 'SOFT',
  //       }),
  //     }).then(r => r.json()),
  //   );
  //   if (enquiryErr) throw enquiryErr;
  //   return _mapExperianResponse(input.borrowerId, raw);

  return config.mode === 'live'
    ? _performLiveSoftPull(input, config)
    : _performMockSoftPull(input, config.providerLabel);
}

/**
 * Convenience: fetch score only (used in underwriting step).
 * Returns null if the bureau call fails — underwriting degrades gracefully.
 */
export async function getBureauScore(
  borrowerId: string,
  idNumber:   string,
  firstName:  string,
  lastName:   string,
): Promise<number | null> {
  const [err, result] = await to(
    performSoftPull({ borrowerId, idNumber, firstName, lastName, consentGranted: true }),
  );
  // Pattern 1 — early return on failure (non-fatal)
  if (err) {
    console.warn('[credit-bureau] soft pull failed:', err.message);
    return null;
  }
  return result!.bureauScore;
}
