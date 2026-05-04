/**
 * @package @capstack/ledger
 *
 * Core financial primitives for the Capstack platform.
 *
 * EXPORTS:
 *   Money            — Immutable monetary value object stored as integer cents (bigint).
 *                      Eliminates all floating-point arithmetic bugs.
 *
 *   LedgerEntry      — A single debit or credit line in a transaction.
 *   LedgerTransaction — A balanced set of entries (debits = credits).
 *   EntryType        — 'DEBIT' | 'CREDIT'
 *
 *   validateTransaction — Throws if debits != credits (double-entry rule).
 *   TransactionBuilder  — Fluent API to build balanced transactions safely.
 *
 * USAGE EXAMPLE:
 *   import { Money, TransactionBuilder } from '@capstack/ledger';
 *
 *   const tx = new TransactionBuilder('Loan disbursement', 'ZAR')
 *     .debit('LOAN_RECEIVABLE',  Money.fromAmount(5000))
 *     .credit('BANK_ACCOUNT',    Money.fromAmount(5000))
 *     .build(); // throws if unbalanced
 *
 * NEXT STEPS:
 *   - Persist LedgerTransaction entries to the LedgerEntry table via @capstack/db
 *   - Add currency validation (currently assumed single-currency per transaction)
 *   - Add support for multi-currency transactions with FX rates
 */
export { Money } from './src/money';
export { validateTransaction, TransactionBuilder } from './src/ledger-entry';
export type { LedgerEntry, LedgerTransaction, EntryType } from './src/ledger-entry';
