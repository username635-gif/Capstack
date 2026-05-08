/**
 * Stitch Open Banking — mock implementation.
 * Replace with real @stitch-money/node-sdk calls when credentials are ready.
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
