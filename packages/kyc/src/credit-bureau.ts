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

// ─── Helper ───────────────────────────────────────────────────────────────────

async function to<T>(p: Promise<T>): Promise<[Error, null] | [null, T]> {
  try {
    return [null, await p];
  } catch (err) {
    return [err instanceof Error ? err : new Error(String(err)), null];
  }
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

  // ── Stub: deterministic mock based on ID number last digit ────────────────
  // ID numbers ending in even digit → good score; odd → fair score.
  // This lets the QA team test both approval and decline flows in demo mode.
  const lastDigit = parseInt(input.idNumber[12] ?? '0', 10);
  const bureauScore = lastDigit % 2 === 0 ? 720 : 610;

  const stubAccounts: CreditAccount[] = [
    {
      accountType:       'PERSONAL_LOAN',
      lender:            'Stub Bank',
      outstandingBalance: 15000,
      monthlyPayment:    950,
      arrearsMonths:     0,
      openedDate:        '2023-06-01',
    },
  ];

  const totalExposure      = stubAccounts.reduce((s, a) => s + a.outstandingBalance, 0);
  const monthlyObligations = stubAccounts.reduce((s, a) => s + a.monthlyPayment, 0);

  // Pattern 7 — shorthand
  return {
    borrowerId:      input.borrowerId,
    bureauScore,
    scoreDate:       new Date().toISOString().slice(0, 10),
    defaultCount:    0,
    judgementCount:  0,
    enquiryCount:    2,
    currentAccounts: stubAccounts,
    totalExposure,
    monthlyObligations,
    provider:        'stub',
  };
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
