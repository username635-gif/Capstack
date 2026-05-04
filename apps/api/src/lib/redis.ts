/**
 * Redis client — Upstash serverless Redis via the REST API.
 *
 * WHY UPSTASH?
 *   - Serverless-compatible (no persistent TCP connection required)
 *   - Works in Next.js App Router API routes and Edge functions
 *   - Free tier: 10,000 commands/day, 256 MB storage
 *
 * CONFIGURATION:
 *   Set these two environment variables in apps/api/.env.local:
 *     UPSTASH_REDIS_REST_URL   = https://<your-db>.upstash.io
 *     UPSTASH_REDIS_REST_TOKEN = <your-token>
 *
 *   Redis.fromEnv() reads both automatically.
 *
 * CURRENT USES:
 *   1. Idempotency cache for POST /api/v1/applications
 *      Key format: idempotency:<Idempotency-Key header value>
 *      TTL: 24 hours
 *
 * FUTURE USES:
 *   - Rate limiting (per partner API key)
 *   - Session tokens
 *   - Background job queues (BullMQ or similar)
 *   - Caching expensive DB queries (e.g. loan product config)
 */
import { Redis } from '@upstash/redis';

export const redis = Redis.fromEnv();
