/**
 * Audit log writer.
 *
 * Appends a record to the AuditLog table every time a sensitive action is
 * performed on a protected resource (loan approval, disbursement, KYC update,
 * repayment posting, etc.).
 *
 * POPIA / FICA / NCA compliance note:
 *   AuditLog records must be retained for a minimum of 5 years.
 *   Do NOT add a pruning job that deletes rows older than that threshold.
 *
 * DESIGN:
 *   writeAuditLog is non-fatal by design. If the database write fails
 *   (e.g., transient connection issue), the error is silently swallowed
 *   after being logged to stderr. The primary operation must never fail
 *   because of an audit side-effect.
 *
 * USAGE:
 *   import { writeAuditLog } from '@/lib/audit';
 *
 *   // After approving a loan:
 *   await writeAuditLog({
 *     actor:      staffClerkId,
 *     actorType:  'STAFF',
 *     action:     'LOAN_APPROVED',
 *     resource:   'Loan',
 *     resourceId: loan.id,
 *     before:     { status: 'SUBMITTED' },
 *     after:      { status: 'APPROVED' },
 *     ip:         req.headers.get('x-forwarded-for') ?? undefined,
 *   });
 *
 * Patterns applied:
 *   1. Early return   — skip write in test environment
 *   3. Nullish coalescing — actor defaults
 *   6. to() helper    — errors become values
 *   7. Property shorthand
 */

const SKIP_AUDIT = process.env.NODE_ENV === 'test';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuditEntry {
  /** The identity that caused the change (Clerk userId, system, API key id). */
  actor:       string;
  /** The type of actor performing the action. */
  actorType:   'BORROWER' | 'STAFF' | 'SYSTEM' | 'PARTNER_API';
  /** Human-readable action code, e.g. LOAN_APPROVED, KYC_INITIATED, REPAYMENT_POSTED. */
  action:      string;
  /** Prisma model name of the affected resource, e.g. 'Loan', 'Application'. */
  resource:    string;
  /** Primary key of the affected record. */
  resourceId:  string;
  /** State of the record before the change (optional, for update actions). */
  before?:     Record<string, unknown>;
  /** State of the record after the change (optional). */
  after?:      Record<string, unknown>;
  /** Client IP address (use x-forwarded-for or CF-Connecting-IP headers). */
  ip?:         string;
  /** Freeform extra metadata. */
  metadata?:   Record<string, unknown>;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

async function to<T>(p: Promise<T>): Promise<[Error, null] | [null, T]> {
  try { return [null, await p]; }
  catch (err) { return [err instanceof Error ? err : new Error(String(err)), null]; }
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Writes an immutable audit log entry.
 *
 * This function is guaranteed not to throw. Failures are logged to stderr.
 */
export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  // Pattern 1 — skip in test environment to avoid DB calls in unit tests
  if (SKIP_AUDIT) return;

  const { prisma } = await import('@capstack/db');

  const {
    actor,
    actorType,
    action,
    resource,
    resourceId,
    before,
    after,
    ip,
    metadata,
  } = entry;

  const [err] = await to(
    prisma.auditLog.create({
      data: {
        actor,       // Pattern 7 — shorthand
        actorType,
        action,
        resource,
        resourceId,
        before:   before   !== undefined ? (before as object) : undefined,
        after:    after    !== undefined ? (after  as object) : undefined,
        ip:       ip       ?? null,
        metadata: metadata ?? null,
      },
    }),
  );

  // Non-fatal — log to stderr but never propagate
  if (err) {
    console.error('[audit] Failed to write audit log:', err.message, { action, resource, resourceId });
  }
}
