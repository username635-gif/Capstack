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

import { createServer } from 'http';
import { serve } from 'inngest/node';
import { inngest } from './inngest/client';
import { dailyAccrual } from './jobs/daily-accrual';
import { updateDelinquency } from './jobs/update-delinquency';
import { underwriteApplication } from './inngest/functions/underwrite';
import { paymentReminders } from './jobs/payment-reminders';
import { retryFailedPayments } from './jobs/retry-payments';
import { retryWebhooks } from './jobs/retry-webhooks';

const handler = serve({
  client: inngest,
  functions: [
    dailyAccrual,
    updateDelinquency,
    underwriteApplication,
    paymentReminders,
    retryFailedPayments,
    retryWebhooks,
  ],
});

const PORT = Number(process.env.WORKERS_PORT ?? 3010);
const server = createServer(handler);

server.listen(PORT, () => {
  console.log(`[workers] Ready — Inngest handler on http://localhost:${PORT}/api/inngest`);
  console.log('[workers] Local dev: npx inngest-cli@latest dev -u http://localhost:3010/api/inngest');
});

process.on('SIGTERM', () => { server.close(); process.exit(0); });
process.on('SIGINT',  () => { server.close(); process.exit(0); });
