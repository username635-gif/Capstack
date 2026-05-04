/**
 * Double-Entry Ledger Primitives
 *
 * OVERVIEW:
 *   Every financial movement in Capstack is recorded as a balanced
 *   double-entry transaction: for every debit there must be an equal credit.
 *   This matches standard accounting (GAAP / IFRS) and prevents money
 *   from being created or destroyed by code bugs.
 *
 * KEY CONCEPTS:
 *   DEBIT  — increases asset/expense accounts; decreases liability/equity accounts.
 *   CREDIT — increases liability/equity/revenue accounts; decreases asset accounts.
 *
 * ACCOUNTS USED IN CAPSTACK (examples):
 *   LOAN_RECEIVABLE      — asset: we are owed this money
 *   BANK_ACCOUNT         — asset: cash held
 *   FUNDING_LIABILITY    — liability: money owed to warehouse/investor
 *   INTEREST_INCOME      — revenue
 *   ORIGINATION_FEE_INCOME — revenue
 *
 * FLOW FOR LOAN DISBURSEMENT:
 *   DR LOAN_RECEIVABLE   5,000.00
 *   CR BANK_ACCOUNT               5,000.00
 *
 * FLOW FOR REPAYMENT:
 *   DR BANK_ACCOUNT      5,600.00
 *   CR LOAN_RECEIVABLE            5,000.00
 *   CR INTEREST_INCOME              600.00
 *
 * TODO (next developer):
 *   - Wire TransactionBuilder.build() to persist entries via @capstack/db
 *   - Add accountId validation against the LedgerAccount table
 *   - Replace the in-memory sequence counter with a proper UUID generator
 *   - Add currency validation across entries in the same transaction
 */

import { Money } from './money';

// ─── Types ────────────────────────────────────────────────────────────────────

export type EntryType = 'DEBIT' | 'CREDIT';

export interface LedgerEntry {
  readonly id: string;
  readonly transactionId: string;
  readonly accountId: string;
  readonly type: EntryType;
  readonly amount: Money;
  readonly currency: string;
  readonly description: string;
  readonly createdAt: Date;
}

export interface LedgerTransaction {
  readonly id: string;
  readonly entries: ReadonlyArray<LedgerEntry>;
  readonly description: string;
  readonly createdAt: Date;
}

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * The fundamental double-entry rule: sum of debits must equal sum of credits.
 * Throws if the transaction is unbalanced.
 */
export function validateTransaction(entries: ReadonlyArray<LedgerEntry>): void {
  let debits = Money.fromCents(0);
  let credits = Money.fromCents(0);

  for (const entry of entries) {
    if (entry.type === 'DEBIT') {
      debits = debits.add(entry.amount);
    } else {
      credits = credits.add(entry.amount);
    }
  }

  if (!debits.equals(credits)) {
    throw new Error(
      `Unbalanced transaction: debits=${debits.toString()} credits=${credits.toString()}`
    );
  }
}

// ─── Builder ──────────────────────────────────────────────────────────────────

let _entrySeq = 0;
function nextId(prefix: string): string {
  return `${prefix}_${Date.now()}_${++_entrySeq}`;
}

/**
 * Fluent builder for creating balanced double-entry transactions.
 *
 * @example
 * const tx = new TransactionBuilder('Loan disbursement', 'ZAR')
 *   .debit('LOAN_BOOK', Money.fromAmount(5000))
 *   .credit('FUNDING_ACCOUNT', Money.fromAmount(5000))
 *   .build();
 */
export class TransactionBuilder {
  private readonly _entries: LedgerEntry[] = [];
  private readonly _txId: string;
  private readonly _createdAt: Date;

  constructor(
    private readonly description: string,
    private readonly currency: string = 'ZAR'
  ) {
    this._txId = nextId('tx');
    this._createdAt = new Date();
  }

  debit(accountId: string, amount: Money, description?: string): this {
    this._entries.push({
      id: nextId('le'),
      transactionId: this._txId,
      accountId,
      type: 'DEBIT',
      amount,
      currency: this.currency,
      description: description ?? this.description,
      createdAt: this._createdAt,
    });
    return this;
  }

  credit(accountId: string, amount: Money, description?: string): this {
    this._entries.push({
      id: nextId('le'),
      transactionId: this._txId,
      accountId,
      type: 'CREDIT',
      amount,
      currency: this.currency,
      description: description ?? this.description,
      createdAt: this._createdAt,
    });
    return this;
  }

  /** Validates and returns the completed transaction. Throws if unbalanced. */
  build(): LedgerTransaction {
    validateTransaction(this._entries);
    return {
      id: this._txId,
      entries: [...this._entries],
      description: this.description,
      createdAt: this._createdAt,
    };
  }
}
