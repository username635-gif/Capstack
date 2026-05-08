/**
 * Bank statement parser — deterministic regex-first approach with an LLM fallback.
 *
 * Patterns applied:
 *   1. Early return — skip LLM if regex already found transactions
 *   3. Optional chaining + nullish coalescing — safe regex group access
 *   5. Array methods — filter/reduce for reconciliation
 *   6. to() helper — wraps pdf-parse promise
 *   7. Property shorthand
 *   8. Pipe-like composition — parse → reconcile as distinct pure functions
 */

import pdfParse from 'pdf-parse';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
  type: 'credit' | 'debit';
}

export interface ParsedStatement {
  openingBalance: number;
  closingBalance: number;
  transactions: ParsedTransaction[];
}

// ─── Helper ───────────────────────────────────────────────────────────────────

async function to<T>(p: Promise<T>): Promise<[Error, null] | [null, T]> {
  try {
    return [null, await p];
  } catch (err) {
    return [err instanceof Error ? err : new Error(String(err)), null];
  }
}

// ─── Deterministic parser ─────────────────────────────────────────────────────

function deterministicParse(text: string): ParsedStatement {
  const opening = text.match(/Opening balance[:\s]*R\s*([\d,]+\.?\d*)/i);
  const closing  = text.match(/Closing balance[:\s]*R\s*([\d,]+\.?\d*)/i);

  // Pattern 3 — nullish coalescing for regex group access
  const openingBalance = opening ? parseFloat(opening[1]?.replace(/,/g, '') ?? '0') : 0;
  const closingBalance = closing  ? parseFloat(closing[1]?.replace(/,/g, '')  ?? '0') : 0;

  // Simple SA bank statement transaction row pattern
  const txnPattern = /(\d{4}-\d{2}-\d{2})\s+(.+?)\s+([-]?\d[\d,]*\.?\d*)\s*(Cr|Dr)?/gi;
  const transactions: ParsedTransaction[] = [];
  let match: RegExpExecArray | null;

  while ((match = txnPattern.exec(text)) !== null) {
    const [, date, description, rawAmount, dir] = match;
    const amount = parseFloat(rawAmount.replace(/,/g, ''));
    // Pattern 2 — ternary for credit/debit detection
    const type: 'credit' | 'debit' = dir?.toLowerCase() === 'cr' || amount > 0 ? 'credit' : 'debit';
    transactions.push({ date, description: description.trim(), amount: Math.abs(amount), type });
  }

  // Pattern 7 — shorthand
  return { openingBalance, closingBalance, transactions };
}

// ─── LLM fallback (stub — replace with OpenAI/Claude call) ───────────────────

async function llmFallback(_pdfBuffer: Buffer): Promise<ParsedStatement> {
  // TODO: call LLM API, return structured JSON
  return {
    openingBalance: 1000,
    closingBalance: 1500,
    transactions: [
      { date: '2026-04-01', description: 'Salary',         amount: 5000,  type: 'credit' },
      { date: '2026-04-02', description: 'Rent',           amount: 2000,  type: 'debit'  },
      { date: '2026-04-10', description: 'Groceries',      amount: 800,   type: 'debit'  },
    ],
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function parseBankStatement(pdfBuffer: Buffer): Promise<ParsedStatement> {
  const [err, data] = await to(pdfParse(pdfBuffer));

  // Pattern 1 — early return on parse failure
  if (err || !data) return llmFallback(pdfBuffer);

  const parsed = deterministicParse(data.text);

  // Pattern 1 — early return: use deterministic result if transactions found
  if (parsed.transactions.length > 0) return parsed;

  return llmFallback(pdfBuffer);
}

// Pattern 8 — pure reconciliation function (compose with parseBankStatement)
export function reconcile(parsed: ParsedStatement): boolean {
  // Pattern 5 — array methods for summation
  const credits = parsed.transactions
    .filter(t => t.type === 'credit')
    .reduce((sum, t) => sum + t.amount, 0);

  const debits = parsed.transactions
    .filter(t => t.type === 'debit')
    .reduce((sum, t) => sum + t.amount, 0);

  const computed = parsed.openingBalance + credits - debits;
  return Math.abs(computed - parsed.closingBalance) < 0.01;
}
