# @capstack/api

Capstack API — the backend for lending origination, servicing, collections, KYC/AML workflows, document generation, and ops/reporting.

## What this app does

- Exposes REST endpoints under `src/app/api/v1/*` for:
  - Auth (`/auth/borrower`, `/auth/staff`, `/auth/partner`)
  - Applications (`/applications`, `/applications/[id]/*`)
  - Borrowers (`/borrowers`, `/borrowers/[id]/*`)
  - Loans & servicing (`/loans`, `/loans/[id]/*`)
  - Dashboard/portfolio, collections, compliance, reporting, underwriting
  - KYC checks (`/kyc/initiate`, `/kyc/webhook`, `/kyc-checks`)
  - Provider integration boundaries (e.g. Stitch, payments webhooks)

## Local dev

```sh
pnpm install
pnpm dev:api
```

API will be available on:
- `http://localhost:3000` (Next.js App Router)

## Project structure (quick map)

- `src/app/api/v1/*` — route handlers (REST)
- `src/app/api/*` — ingent web handlers / proxies (where applicable)
- `src/lib/*` — shared services (auth helpers, notifications, disbursement, PDF generators, etc.)
- `src/lib/pdf/*` — PDF rendering helpers used by ops downloads

## Environment variables

Copy the app-local example:
- `apps/api/.env.example`

The root `.env` is intentionally minimal; most integration variables are provided per app via `.env.example`.

## Verification

Run:

```sh
pnpm -C apps/api build
```

This will typecheck + run Next.js production build checks.

---

## UI Theming Notes (Light/Dark)

The API app also ships shared UI components/styles (for routes like ops downloads and tokenized UI surfaces).

Design tokens live in `src/app/globals.css`, including light-mode `:root` and dark-mode `[data-theme="dark"]` variables.


