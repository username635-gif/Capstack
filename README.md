# Capstack

A full-stack lending-as-a-service (LaaS) monorepo built with Turborepo, Next.js, Prisma, and Neon (serverless Postgres).

Capstack provides the infrastructure for originating, servicing, and collecting on consumer and SME loans — including credit decisioning, KYC/AML, open banking, and double-entry ledger accounting.

---

## Architecture

```
apps/
  api/        → REST API (Next.js App Router, port 3000)
  borrower/   → Borrower-facing portal (port 3001)
  ops/        → Internal operations dashboard (port 3002)
  partner/    → Lending partner portal (port 3003)
  workers/    → Background job runner (BullMQ / Inngest — coming soon)

packages/
  db/           → Prisma client singleton + Neon adapter
  ledger/       → Money (bigint cents) + double-entry bookkeeping primitives
  pricing/      → Loan amortization schedule calculators (PMT, bullet)
  ai/           → LLM/AI stubs (OpenAI, Anthropic — coming soon)
  kyc/          → KYC/AML stubs (Onfido — coming soon)
  integrations/ → Open banking + payment stubs (Stitch, Stripe — coming soon)
```

---

## Prerequisites

- [Node.js](https://nodejs.org/) ≥ 20
- [pnpm](https://pnpm.io/) ≥ 9
- [Neon](https://neon.tech/) database (serverless Postgres)
- [Upstash Redis](https://upstash.com/) (for idempotency caching)

---

## Getting started

```sh
# 1. Install dependencies
pnpm install

# 2. Set up environment variables (see below)

# 3. Generate the Prisma client
pnpm --filter @capstack/db generate

# 4. Push the schema to your Neon database
pnpm --filter @capstack/db exec prisma db push

# 5. Start all apps in development mode
pnpm dev
```

---

## Environment variables

Create `apps/api/.env.local` with the following:

```env
# Neon PostgreSQL (serverless)
DATABASE_URL="postgresql://user:password@ep-xxx.neon.tech/capstack?sslmode=require"

# Upstash Redis (for idempotency key caching)
UPSTASH_REDIS_REST_URL="https://your-redis.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your-token"
```

---

## Developer commands

| Command | Description |
|---|---|
| `pnpm dev` | Start all apps (hot reload) |
| `pnpm build` | Build all apps and packages |
| `pnpm --filter api dev` | Start only the API on port 3000 |
| `pnpm --filter borrower dev` | Start only the borrower portal on port 3001 |
| `pnpm --filter ops dev` | Start only the ops dashboard on port 3002 |
| `pnpm --filter partner dev` | Start only the partner portal on port 3003 |
| `pnpm --filter @capstack/db studio` | Open Prisma Studio (database GUI) |

---

## Key API endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/applications` | Submit a loan application (idempotent) |

Pass an `idempotency-key` header (UUID) on write requests. Duplicate requests within 24 hours return the cached response with `X-Idempotent: true`.

---

## Packages

### `@capstack/db`
Prisma client configured with the Neon serverless adapter (`@prisma/adapter-neon`). Exports a global singleton `prisma` that is safe to use in Next.js with hot reload.

### `@capstack/ledger`
- **`Money`** — floating-point-safe currency class backed by bigint cents. Never use raw `number` for monetary values.
- **`TransactionBuilder`** — fluent API for constructing balanced double-entry ledger transactions. All transactions must have equal total debits and credits (enforced by `validateTransaction()`).

### `@capstack/pricing`
- **`calculateAmortizationSchedule()`** — routes to the correct calculator based on `method` (`EQUAL_INSTALLMENT` or `BULLET`).
- All inputs use cents and basis points (bps) to avoid floating-point issues.

---

## Tech stack

| Layer | Technology |
|---|---|
| Monorepo | Turborepo + pnpm workspaces |
| Framework | Next.js 15 (App Router, Turbopack) |
| Language | TypeScript (strict) |
| Database | Neon (serverless Postgres) via Prisma v7 |
| Cache / Queue | Upstash Redis |
| Styling | Tailwind CSS |

---

## Roadmap

- [ ] KYC integration (Onfido)
- [ ] Open banking / bank account linking (Stitch)
- [ ] Payment collection (Stripe / DebiCheck)
- [ ] AI-powered credit narrative (OpenAI GPT-4o)
- [ ] Background job queues (BullMQ / Inngest)
- [ ] Authentication (Clerk / NextAuth)
- [ ] Multi-tenant lender isolation

---

## Contributing

This is a private monorepo. Please follow the notes in each package's source files before making changes. Run `pnpm build` before committing to verify there are no TypeScript errors.
