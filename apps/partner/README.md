# @capstack/partner

Capstack partner portal — product discovery and partner intake flows.

## What this app does

Key pages:

- `/` — partner landing page
- `/sign-in` — partner auth
- `/products` — product catalog
- `/applications` — partner applications table
- `/applications/new` — multi-step partner submission flow
- `/loans` — partner loans view
- `/reports` — partner report view
- `/api-keys` — API key management UI
- `/settings` — partner settings

## Local dev

```sh
pnpm install
pnpm dev:partner
```

Ports:
- API: `http://localhost:3000`
- Partner: `http://localhost:3003`

## Demo vs live behavior

The partner portal contains both live hooks and demo-backed screens.
Where providers/integration credentials are not configured, demo fallback state ensures the UX remains navigable.

## Project structure (quick map)

- `src/app/*` — pages
- `src/lib/*` — partner session + client helpers

## Verification

Run:

```sh
pnpm -C apps/partner build
```

---

## UI Theming Notes (Light/Dark)

Partner UI theming uses CSS design tokens defined in `src/app/globals.css`.

Dark mode overrides are defined under `[data-theme="dark"]`.


