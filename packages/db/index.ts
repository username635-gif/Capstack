/**
 * @package @capstack/db
 *
 * Single source of truth for the Prisma client used across the entire monorepo.
 *
 * DATABASE:
 *   Neon (serverless PostgreSQL). Connection string must be set in the
 *   environment as DATABASE_URL (e.g. in packages/db/.env or each app's .env.local).
 *
 * PRISMA VERSION: v7 (driver-adapter mode — no built-in TCP connection pooler).
 *   Because Neon is serverless, we use the official @prisma/adapter-neon driver
 *   adapter instead of the classic DATABASE_URL connection mode.
 *
 * HOW TO USE:
 *   import { prisma } from '@capstack/db';
 *   const loans = await prisma.loan.findMany();
 *
 * HOW TO REGENERATE THE CLIENT after schema changes:
 *   cd packages/db && npx prisma generate
 *   (or: pnpm --filter @capstack/db generate)
 *
 * HOW TO PUSH SCHEMA CHANGES TO THE DATABASE:
 *   cd packages/db && npx prisma db push
 *
 * HOW TO OPEN PRISMA STUDIO (visual DB browser):
 *   pnpm --filter @capstack/db studio
 */

import { neonConfig } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from './generated/prisma/client';

// Neon's serverless driver communicates over HTTP by default.
// In a regular Node.js process (not Vercel Edge / Cloudflare Workers),
// WebSocket is not available globally, so we polyfill it with the 'ws' package.
// This enables Neon's real-time query streaming in non-edge environments.
if (typeof WebSocket === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  neonConfig.webSocketConstructor = require('ws');
}

/**
 * Factory — creates a new PrismaClient wired to the Neon serverless adapter.
 * Called once at startup (or once per cold start in serverless environments).
 *
 * Note: DATABASE_URL must contain the full Neon connection string including
 * sslmode=require, e.g.:
 *   postgresql://user:pass@host.neon.tech/dbname?sslmode=require
 */
function createPrismaClient() {
  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
  return new PrismaClient({ adapter });
}

// Singleton pattern: reuse the same PrismaClient instance across hot reloads
// in Next.js development. In production (NODE_ENV=production) a new instance
// is created for each cold start — that is acceptable for serverless workloads.
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Re-export everything from the generated client so consumers only need to
// import from '@capstack/db' — they never need to import generated files directly.
export * from './generated/prisma/client';
