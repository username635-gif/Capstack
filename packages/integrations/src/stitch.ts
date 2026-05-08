/**
 * Stitch Open Banking — mock implementation.
 * Replace with real @stitch-money/node-sdk calls when credentials are ready.
 *
 * WHAT STITCH DOES:
 *   Stitch is a South African open banking provider. It lets Capstack:
 *   1. Read 90 days of bank transactions for bank statement analysis (affordability)
 *   2. Initiate real-time account-to-account payouts (faster than PayFast for some banks)
 *   3. Verify account ownership without manual upload
 *
 * PRODUCTION INTEGRATION STEPS:
 *   1. Create account at https://stitch.money and get client credentials
 *   2. Set env: STITCH_CLIENT_ID, STITCH_CLIENT_SECRET
 *   3. Replace createLinkToken() with the real Stitch OAuth link flow
 *   4. Replace fetchTransactions() with real GraphQL query to Stitch's API
 *   5. Replace stitchPayout() with real PaymentInitiation mutation
 *
 * The mock currently returns 4 fixture transactions (salary + rent + groceries + airtime).
 * This is enough data for the bank statement parser to run in demo mode.
 *
 * Patterns applied:
 *   1. Early return — functions return deterministically without nested logic
 *   3. Optional chaining + nullish coalescing — default for optional params
 *   7. Property shorthand — { transactions } etc.
 */

export interface StitchTransaction {
  date: string;
  description: string;
  amount: number;
  type: 'credit' | 'debit';
}

export interface StitchTransactionsResult {
  transactions: StitchTransaction[];
}

export interface StitchPayoutResult {
  id: string;
  status: string;
  reference: string;
}

// Mock link token — replace with real Stitch OAuth flow
export async function createLinkToken(borrowerId: string): Promise<string> {
  return `mock_stitch_token_${borrowerId}`;
}

// Mock transaction fetch — returns deterministic fixture data
export async function fetchTransactions(
  _accessToken: string,
  days = 90,
): Promise<StitchTransactionsResult> {
  const transactions: StitchTransaction[] = (
    [
      { date: '2026-04-01', description: 'Salary',    amount:  50000, type: 'credit' as const },
      { date: '2026-04-05', description: 'Rent',      amount: -15000, type: 'debit'  as const },
      { date: '2026-04-10', description: 'Groceries', amount:  -2500, type: 'debit'  as const },
      { date: '2026-04-15', description: 'Airtime',   amount:   -500, type: 'debit'  as const },
    ] as StitchTransaction[]
  ).slice(0, days > 30 ? 4 : 2);

  // Pattern 7 — shorthand
  return { transactions };
}

// Mock payout used as fallback in multi-rail disbursement
export async function stitchPayout(
  reference: string,
  amount: number,
): Promise<StitchPayoutResult> {
  const id = `mock_stitch_payout_${reference}_${Date.now()}`;
  const status = 'INITIATED';
  // Pattern 7 — property shorthand
  return { id, status, reference };
}
