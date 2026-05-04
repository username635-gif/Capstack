/**
 * @app workers
 *
 * Background job runner for the Capstack platform.
 *
 * PURPOSE:
 *   Handles async processing that should not block API responses:
 *     - Credit decision callbacks (ML model scoring)
 *     - Loan disbursement triggers (call Stitch after approval)
 *     - Collection reminders (SMS/email before due dates)
 *     - KYC webhook processing (handle Onfido results)
 *     - Nightly reconciliation jobs
 *
 * HOW TO RUN:
 *   pnpm --filter @capstack/workers dev       # development (tsx watch)
 *   pnpm --filter @capstack/workers start     # production (compiled JS)
 *
 * TECHNOLOGY CHOICE:
 *   Currently a plain Node.js process. For production, consider:
 *     - BullMQ (Redis-backed queues) — pnpm add bullmq
 *     - Trigger.dev (managed background jobs)
 *     - Inngest (event-driven functions, works with Next.js)
 *
 * SCALING NOTE:
 *   Workers should be stateless. Store all state in the database or Redis.
 *   Multiple worker instances can run in parallel safely.
 *
 * TODO (next developer):
 *   1. Install BullMQ: pnpm add bullmq --filter @capstack/workers
 *   2. Create a shared Redis connection (reuse UPSTASH_REDIS_REST_URL)
 *   3. Create queue files per domain (e.g. src/workers/creditDecision.ts)
 *   4. Register queues in this file
 */

console.log('[workers] Starting Capstack worker process...');

// Future: import and register queue handlers here
// import { startCreditDecisionWorker } from './workers/creditDecision';
// import { startDisbursementWorker } from './workers/disbursement';
// import { startCollectionWorker } from './workers/collection';

process.on('SIGTERM', () => {
  console.log('[workers] Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[workers] Received SIGINT, shutting down gracefully...');
  process.exit(0);
});
