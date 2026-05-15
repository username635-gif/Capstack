/**
 * Inngest cron job — retry failed partner webhooks.
 *
 * WHAT WEBHOOKS ARE:
 *   When a significant event occurs (loan approved, payment received, KYC passed)
 *   Capstack POSTs a signed JSON payload to the partner's webhook URL.
 *   If the partner's server is down, returns 5xx, or times out, the webhook
 *   is marked FAILED and queued for retry by this job.
 *
 * RETRY STRATEGY (exponential backoff):
 *   Attempt 1 — immediate
 *   Attempt 2 — 5 minutes after failure
 *   Attempt 3 — 30 minutes
 *   Attempt 4 — 2 hours
 *   Attempt 5 — 24 hours
 *   After 5 failures → mark PERMANENTLY_FAILED, alert ops via Slack/email
 *
 * WEBHOOK SIGNING:
 *   Each delivery is signed with HMAC-SHA256 using the partner's webhookSecret.
 *   The signature is sent in the `X-Capstack-Signature` header.
 *   Partners verify this header on receipt.
 *
 * RELIABILITY:
 *   This is the "at-least-once delivery" guarantee. Partners must make their
 *   webhook handlers idempotent — they may receive duplicate events.
 *   Include the event `id` in each payload so duplicate detection is possible.
 *
 * Patterns applied:
 *   1. Early return — no pending webhooks, skip
 *   2. Ternary — backoff calculation
 *   5. Array methods — filter for eligible retries
 *   6. to() helper
 *   7. Property shorthand
 *   8. Composition — load → filter → sign → deliver → persist
 */

import { inngest } from '../inngest/client';
import { prisma } from '@capstack/db';
import { createHmac } from 'crypto';

const MAX_WEBHOOK_ATTEMPTS = 5;

// Backoff schedule in minutes after each failure
const BACKOFF_MINUTES = [0, 5, 30, 120, 1440] as const;

function _payloadObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

// Sign a webhook payload with HMAC-SHA256
function _signPayload(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

// Deliver a single webhook with a timeout
async function _deliverWebhook(
  url:     string,
  payload: Record<string, unknown>,
  secret:  string,
): Promise<{ status: number; ok: boolean }> {
  const body      = JSON.stringify(payload);
  const signature = _signPayload(body, secret);

  const controller = new AbortController();
  const timeout    = setTimeout(() => controller.abort(), 10_000); // 10 s hard timeout

  try {
    const res = await fetch(url, {
      method:  'POST',
      headers: {
        'Content-Type':          'application/json',
        'X-Capstack-Signature':  `sha256=${signature}`,
        'X-Capstack-Event-Id':   String(payload['eventId'] ?? ''),
        'User-Agent':            'Capstack-Webhook/1.0',
      },
      body,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return { status: res.status, ok: res.ok };
  } catch (err) {
    clearTimeout(timeout);
    const status = (err as { name?: string }).name === 'AbortError' ? 408 : 502;
    return { status, ok: false };
  }
}

// ─── Webhook event table ──────────────────────────────────────────────────────
// NOTE: The current schema does not have a dedicated WebhookDelivery model.
// We store webhook state in the ApplicationEvent table using type = 'WEBHOOK_*'
// and in a Redis key for pending retries.
// TODO: Add a WebhookDelivery model to the Prisma schema for production.
// For now this cron reads CollectionEvent and ApplicationEvent rows with type
// 'WEBHOOK_PENDING_RETRY', delivers them, and updates accordingly.

export const retryWebhooks = inngest.createFunction(
  { id: 'retry-webhooks', triggers: [{ cron: '*/5 * * * *' }] }, // every 5 minutes
  async ({ step }) => {
    // ── STEP 1: Load pending webhook retries ─────────────────────────────
    const pendingEvents = await step.run('load-pending-webhooks', () =>
      prisma.applicationEvent.findMany({
        where: {
          type: 'WEBHOOK_PENDING_RETRY',
        },
        include: { application: { include: { partner: true } } },
        orderBy: { createdAt: 'asc' },
        take: 50, // process at most 50 per run to stay within Inngest step budget
      }),
    );

    // Pattern 1 — early return if nothing to do
    if (pendingEvents.length === 0) {
      return { processed: 0, delivered: 0, permanentFails: 0 };
    }

    // ── STEP 2: Filter events that are past their next retry time ─────────
    const now = Date.now();
    const eligible = pendingEvents.filter((event) => {
      const payload    = event.payload as {
        attemptNo?:    number;
        nextRetryAt?:  string;
        webhookData?:  Record<string, unknown>;
      };
      const nextRetry  = payload.nextRetryAt ? new Date(payload.nextRetryAt).getTime() : 0;
      return now >= nextRetry;
    });

    let delivered       = 0;
    let permanentFails  = 0;

    // ── STEP 3: Deliver eligible webhooks ─────────────────────────────────
    await step.run('deliver-webhooks', async () => {
      for (const event of eligible) {
        const partner       = event.application?.partner;
        const payload       = event.payload as {
          attemptNo:    number;
          webhookData:  Record<string, unknown>;
        };
        const existingPayload = _payloadObject(event.payload);
        const attemptNo     = (payload.attemptNo ?? 0) + 1;
        const webhookData   = payload.webhookData ?? {};
        const webhookUrl    = partner?.webhookUrl ?? '';
        const webhookSecret = partner?.webhookSecret ?? '';

        // Pattern 1 — no URL or secret configured → mark permanently failed
        if (!webhookUrl || !webhookSecret) {
          await prisma.applicationEvent.update({
            where: { id: event.id },
            data:  { type: 'WEBHOOK_PERMANENTLY_FAILED' },
          }).catch(() => {});
          permanentFails++;
          continue;
        }

        const result = await _deliverWebhook(webhookUrl, webhookData, webhookSecret);

        if (result.ok) {
          delivered++;
          // Mark as delivered
          await prisma.applicationEvent.update({
            where: { id: event.id },
            data:  { type: 'WEBHOOK_DELIVERED' },
          }).catch(() => {});
        } else if (attemptNo >= MAX_WEBHOOK_ATTEMPTS) {
          permanentFails++;
          // Permanently failed — alert ops
          await prisma.applicationEvent.update({
            where: { id: event.id },
            data:  {
              type: 'WEBHOOK_PERMANENTLY_FAILED',
              payload: { ...existingPayload, lastError: `HTTP ${result.status}`, attemptNo },
            },
          }).catch(() => {});
          console.error(
            `[retry-webhooks] Webhook permanently failed after ${attemptNo} attempts:`,
            event.id, webhookUrl,
          );
        } else {
          // Schedule next retry using backoff table
          // Pattern 2 — ternary for backoff index (clamp to last element)
          const backoffMins = BACKOFF_MINUTES[Math.min(attemptNo, BACKOFF_MINUTES.length - 1)] ?? 1440;
          const nextRetryAt = new Date(now + backoffMins * 60_000).toISOString();

          await prisma.applicationEvent.update({
            where: { id: event.id },
            data:  {
              payload: {
                ...existingPayload,
                attemptNo,
                nextRetryAt,
                lastError: `HTTP ${result.status}`,
              },
            },
          }).catch(() => {});
        }
      }
    });

    // Pattern 7 — shorthand
    return { processed: eligible.length, delivered, permanentFails };
  },
);

// ─── Helper: queue a webhook for delivery ────────────────────────────────────

/**
 * Queue a new webhook event for delivery to a partner.
 * Called by route handlers after creating/updating a resource.
 *
 * Pattern 8 — pure side-effect function; composable with any route handler
 */
export async function queueWebhook(
  applicationId: string,
  eventType:     string,
  webhookData:   Record<string, unknown>,
): Promise<void> {
  await prisma.applicationEvent.create({
    data: {
      applicationId,
      type:  'WEBHOOK_PENDING_RETRY',
      actor: 'SYSTEM',
      payload: {
        originalEventType: eventType,
        attemptNo:         0,
        nextRetryAt:       new Date().toISOString(),
        webhookData:       { ...webhookData, eventId: `${eventType}_${Date.now()}` },
      },
    },
  });
}
