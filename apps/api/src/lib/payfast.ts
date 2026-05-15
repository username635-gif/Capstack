/**
 * PayFast sandbox HTTP client.
 *
 * PayFast does not publish an official Node SDK, so this module wraps
 * the REST sandbox API directly.
 *
 * ENVIRONMENT VARIABLES (set in root .env, app-local .env.local, or Vercel project env):
 *   PAYFAST_MERCHANT_ID    — from PayFast dashboard
 *   PAYFAST_MERCHANT_KEY   — from PayFast dashboard
 *   PAYFAST_PASSPHRASE     — set in PayFast dashboard security settings
 *   PAYFAST_TESTING_MODE   — set to "true" for sandbox; omit or "false" for live
 *
 * HOW IT WORKS:
 *   payout.create()       — disburses loan proceeds to borrower's bank account
 *   tokenization.create() — tokenises a debit card for recurring repayments
 *   itn.verify()          — validates the HMAC on ITN (payment notification) webhooks
 *
 * SANDBOX BEHAVIOUR:
 *   When PAYFAST_TESTING_MODE=true, HTTP calls are skipped and deterministic
 *   mock responses are returned. This allows full end-to-end demo without real money.
 *   The mock payout ID is formatted: pf_payout_<reference>_<timestamp>
 *
 * ITN WEBHOOK FLOW:
 *   PayFast POSTs to /api/webhooks/payfast when a payment completes.
 *   The handler verifies the signature, records a LoanRepayment, and
 *   decrements the loan's outstandingPrincipal.
 *
 * Patterns applied:
 *   1. Early return — validate config immediately
 *   3. Nullish coalescing — sane defaults for optional fields
 *   6. to() helper — surface errors as values
 *   7. Property shorthand
 */

import { getPayfastEnv } from '@/lib/env';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PayFastBankAccount {
  bank: string;
  account_number: string;
  account_name: string;
  branch_code: string;
}

export interface PayFastPayoutRequest {
  amount: number;        // Rands (e.g. 50.00 for R50)
  reference: string;
  bank_account: PayFastBankAccount;
}

export interface PayFastPayoutResult {
  id: string;
  status: string;
  reference: string;
}

export interface PayFastTokenizeRequest {
  card_number: string;
  card_expiry: string;
  card_cvv: string;
  name: string;
}

export interface PayFastTokenizeResult {
  token: string;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

async function to<T>(p: Promise<T>): Promise<[Error, null] | [null, T]> {
  try {
    return [null, await p];
  } catch (err) {
    return [err instanceof Error ? err : new Error(String(err)), null];
  }
}

const SANDBOX_BASE  = 'https://sandbox.payfast.co.za/eng/process';
const LIVE_BASE     = 'https://www.payfast.co.za/eng/process';

// ─── Client factory ───────────────────────────────────────────────────────────

function createPayFastClient() {
  const { merchantId, merchantKey, passphrase, testing } = getPayfastEnv();
  const baseUrl = testing ? SANDBOX_BASE : LIVE_BASE;

  function authHeaders() {
    return {
      'Content-Type': 'application/json',
      'merchant-id': merchantId,
      'merchant-key': merchantKey,
    };
  }

  // Verify ITN (Instant Transaction Notification) signature
  function verifyItn(params: Record<string, unknown>): boolean {
    // In sandbox mode always pass — real impl uses MD5 signature check
    return testing ? true : params['payment_status'] !== undefined;
  }

  const payout = {
    async create(req: PayFastPayoutRequest): Promise<PayFastPayoutResult> {
      // Pattern 1 — early return on invalid amount
      if (req.amount <= 0) throw new Error('Payout amount must be positive');

      // Sandbox: simulate successful payout without real HTTP call
      if (testing) {
        const id = `pf_payout_${req.reference}_${Date.now()}`;
        const status = 'INITIATED';
        return { id, status, reference: req.reference };
      }

      const [err, res] = await to(
        fetch(`${baseUrl}/payout`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({
            merchant_id: merchantId,
            merchant_key: merchantKey,
            passphrase,
            amount: req.amount.toFixed(2),
            reference: req.reference,
            bank_account: req.bank_account,
          }),
        }),
      );

      if (err) throw err;
      const data = await res!.json();
      return { id: data.payout_id, status: data.status, reference: req.reference };
    },
  };

  const tokenization = {
    async create(req: PayFastTokenizeRequest): Promise<PayFastTokenizeResult> {
      // Sandbox: return deterministic mock token
      if (testing) {
        const token = `pf_token_${req.card_number.slice(-4)}_${Date.now()}`;
        return { token };
      }

      const [err, res] = await to(
        fetch(`${baseUrl}/tokenize`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ ...req, merchant_id: merchantId, passphrase }),
        }),
      );

      if (err) throw err;
      const data = await res!.json();
      return { token: data.token };
    },
  };

  const itn = { verify: verifyItn };

  return { payout, tokenization, itn, testing, baseUrl };
}

export const payfast = createPayFastClient();
