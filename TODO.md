# TODO

## Goal
Fix Vercel build/install override for `apps/partner` so Vercel uses default pnpm install (no custom install commands).

## Plan (step-by-step)
1. Update `apps/partner/vercel.json`: remove any custom `installCommand` so the file is only `{ "framework": "nextjs" }`.
2. Update `apps/partner/package.json`: remove any `packageManager` field if present.
3. Verify root `package.json` contains `"packageManager": "pnpm@10.33.2"`.
4. Ensure `apps/ops` and `apps/borrower` are not modified.
5. From monorepo root, run `pnpm install` to regenerate/update `pnpm-lock.yaml`.
6. Commit and push the changes.

