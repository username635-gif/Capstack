# @capstack/borrower

Capstack borrower-facing portal.

## What this app does

- Marketing landing page (`/`)
- Borrower auth (`/sign-in`)
- Borrower registration (`/sign-up`)
- Loan application flow (`/apply`)
- Borrower dashboard (`/dashboard`) with active loans + applications (demo-first fallback, then background API refresh)
- Downloads center (`/downloads`) for statements/agreements (demo fallback if API is unavailable)

## Local dev

```sh
pnpm install
pnpm dev:borrower
```

Ports:
- API: `http://localhost:3000`
- Borrower: `http://localhost:3001`

## Project structure (quick map)

- `src/app/*` — pages and routes
- `src/lib/session.ts` — borrower session storage/timeout
- `src/proxy.ts` — proxy helpers for same-origin API calls
- `src/components/*` — UI building blocks (hero background, overlays, etc.)

## Demo vs live behavior

Some pages are **hybrid**:
- UI renders with demo/fixture state immediately.
- Then it attempts to fetch live data in the background.

This is intentional so the portal remains usable even when integration credentials/providers are not configured.

## Verification

Run:

```sh
pnpm -C apps/borrower build
```

---

## UI Theming Notes (Light/Dark)

Borrower UI theming is tokenized.

- Light mode uses `:root` variables.
- Dark mode uses `[data-theme="dark"]` variables.

See `src/app/globals.css` for the authoritative token definitions.


