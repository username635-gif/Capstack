/**
 * Sanctions & PEP (Politically Exposed Person) screening stub.
 * Replace with a real provider when credentials are available.
 *
 * WHY THIS EXISTS:
 *   FICA (Financial Intelligence Centre Act) requires South African lenders to
 *   screen all borrowers against sanctions lists and PEP databases before
 *   disbursing funds. Failure to do so is a criminal offence.
 *
 * PRODUCTION INTEGRATION OPTIONS:
 *   - ComplyAdvantage (recommended for SA fintechs)
 *   - Dow Jones Risk & Compliance
 *   - Refinitiv World-Check
 *   - Trulioo (global + SA coverage)
 *
 * When integrating, call checkSanctions() during borrower onboarding
 * (POST /api/v1/borrowers) AND before every disbursement as a second check.
 * A `hit: true` result must block the transaction and trigger a SAR
 * (Suspicious Activity Report) filed with the FIC.
 *
 * Patterns applied:
 *   1. Early return — validate input
 *   7. Property shorthand
 */

export interface SanctionsResult {
  hit: boolean;
  pep: boolean;
  matchScore?: number;
  details?: string;
}

export async function checkSanctions(name: string): Promise<SanctionsResult> {
  // Pattern 1 — early return on empty name
  if (!name?.trim()) {
    return { hit: false, pep: false, matchScore: 0 };
  }

  // Stub: no real check — always returns no hits
  const hit        = false;
  const pep        = false;
  const matchScore = 0;
  // Pattern 7 — shorthand
  return { hit, pep, matchScore };
}
