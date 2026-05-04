// ─── Integrations Stubs ───────────────────────────────────────────────────────
// Placeholder interfaces and stubs for:
//   • Stitch — open banking / bank account linking (South Africa)
//   • Stripe — card payments and payouts

// ── Stitch ───────────────────────────────────────────────────────────────────

export interface StitchLinkTokenResult {
  linkToken: string;
  expiresAt: Date;
}

export interface StitchBankAccount {
  accountId: string;
  bankName: string;
  accountNumber: string;
  accountType: 'CHEQUE' | 'SAVINGS';
  holderName: string;
}

export interface StitchPaymentResult {
  paymentId: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  amountCents: number;
  currency: string;
  createdAt: Date;
}

/**
 * Generate a Stitch Link token for bank account linking flow.
 * TODO: Wire up to Stitch API (https://stitch.money/docs).
 */
export async function createStitchLinkToken(
  _userId: string
): Promise<StitchLinkTokenResult> {
  return {
    linkToken: `stub_stitch_link_${Date.now()}`,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 min
  };
}

/**
 * Retrieve linked bank account details via Stitch.
 */
export async function getStitchBankAccount(
  _linkedAccountId: string
): Promise<StitchBankAccount> {
  return {
    accountId: 'stub_account',
    bankName: 'Stub Bank',
    accountNumber: '0000000000',
    accountType: 'CHEQUE',
    holderName: 'Test User',
  };
}

/**
 * Initiate a DebiCheck / instant EFT disbursement via Stitch.
 */
export async function initiateStitchDisbursement(
  _linkedAccountId: string,
  _amountCents: number,
  _reference: string
): Promise<StitchPaymentResult> {
  return {
    paymentId: `stub_disbursement_${Date.now()}`,
    status: 'PENDING',
    amountCents: _amountCents,
    currency: 'ZAR',
    createdAt: new Date(),
  };
}

// ── Stripe ────────────────────────────────────────────────────────────────────

export interface StripePaymentIntentResult {
  intentId: string;
  clientSecret: string;
  status: string;
  amountCents: number;
}

export interface StripePayoutResult {
  payoutId: string;
  status: string;
  amountCents: number;
  currency: string;
  arrivalDate: Date;
}

/**
 * Create a Stripe PaymentIntent for a repayment collection.
 * TODO: Wire up to Stripe SDK (https://stripe.com/docs).
 */
export async function createStripePaymentIntent(
  _amountCents: number,
  _currency: string,
  _customerId: string
): Promise<StripePaymentIntentResult> {
  return {
    intentId: `stub_pi_${Date.now()}`,
    clientSecret: 'stub_secret',
    status: 'requires_payment_method',
    amountCents: _amountCents,
  };
}

/**
 * Initiate a Stripe payout to a connected account (loan disbursement).
 */
export async function createStripePayout(
  _amountCents: number,
  _currency: string,
  _destinationAccountId: string
): Promise<StripePayoutResult> {
  return {
    payoutId: `stub_po_${Date.now()}`,
    status: 'pending',
    amountCents: _amountCents,
    currency: _currency,
    arrivalDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // T+2
  };
}
