# @capstack/ops

Capstack ops console — internal operations dashboard for underwriting/portfolio oversight, compliance, collections, and reporting.

## What this app does

Key pages:

- `/` — ops command center
- `/applications` — applications queue
- `/applications/[id]` — application review/details
- `/collections` — collections workbench
- `/kyc` — compliance/kyc queue
- `/loans` and `/loans/[id]` — ops loan oversight (demo-backed loan detail surfaces currently)
- `/reports` — reporting overview
- `/reports/fairness` — fairness report route
- `/reports/stress-test` — stress test page
- `/downloads` — support/downloads area
- `/settings` — operational settings/documentation
- `/sign-in` — ops staff sign-in

## Local dev

```sh
pnpm install
pnpm dev:ops
```

Ports:
- API: `http://localhost:3000`
- Ops: `http://localhost:3002`

## Project structure (quick map)

- `src/app/*` — Next.js pages
- `src/app/_components/*` — shared shell/layout (theme, interactive surfaces, ops header/footer)
- `src/lib/*` — ops authentication, proxy helpers, shared utilities
- `src/hooks/*` — UI data hooks (filters, loans fetching)

## Demo vs live behavior

The ops UI is a mix:
- Some screens are designed to use live API routes.
- Some screens still use demo fixture state or demo auth/staged flows so the UI remains functional without full provider wiring.

## Verification

Run:

```sh
pnpm -C apps/ops build
```

