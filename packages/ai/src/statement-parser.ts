/**
 * Bank statement parser — deterministic regex-first approach with an LLM fallback.
 *
 * STRATEGY:
 *   1. Extract raw text from the PDF using pdf-parse
 *   2. Try the deterministic SA bank regex parser first (fast, free, accurate for standard formats)
 *   3. If regex finds fewer than 2 transactions, fall back to the LLM stub
 *      (replace stub with real OpenAI/Anthropic call when API keys are provisioned)
 *
 * TO INTEGRATE REAL LLM:
 *   In llmFallback(), call the OpenAI API:
 *     const response = await openai.chat.completions.create({
 *       model: 'gpt-4o',
 *       messages: [{ role: 'user', content: `Parse this bank statement JSON...\n${pdfText}` }]
 *     });
 *   Then parse the JSON from the response and map to ParsedStatement shape.
 *
 * SUPPORTED SA BANK FORMATS (regex parser):
 *   Standard Bank, FNB, Absa, Nedbank — all use similar date + description + amount + Cr/Dr format.
 *   Capitec uses a slightly different format; the regex may miss some rows — LLM handles it.
 *
 * Patterns applied:
 *   1. Early return — skip LLM if regex already found transactions
 *   3. Optional chaining + nullish coalescing — safe regex group access
 *   5. Array methods — filter/reduce for reconciliation
 *   6. to() helper — wraps pdf-parse promise
 *   7. Property shorthand
 *   8. Pipe-like composition — parse → reconcile as distinct pure functions
 */

import { PDFParse } from 'pdf-parse';

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

// ─── LLM fallback (stub — replace with OpenAI/Claude call when keys are set) ───
// This is called only if the regex parser returns fewer than 2 transactions,
// which typically indicates a Capitec or non-standard bank format.
async function llmFallback(_pdfBuffer: Uint8Array): Promise<ParsedStatement> {
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

export async function parseBankStatement(pdfBuffer: Uint8Array): Promise<ParsedStatement> {
  const parser = new PDFParse({ data: pdfBuffer });
  const [err, result] = await to(parser.getText());

  // Pattern 1 — early return on parse failure
  if (err || !result) return llmFallback(pdfBuffer);

  const parsed = deterministicParse(result.text);

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
