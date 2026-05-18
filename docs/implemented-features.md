# Capstack Implemented Features Guide

This document is a source-of-truth overview of what is currently implemented in the Capstack repository.

It is intentionally split by status:

- Live-backed: reads or writes real API and database-backed data.
- Hybrid: real API hooks exist, but the UI still uses demo fallback data or a staged auth path.
- Demo-backed: mostly front-end fixture state or preview flows.
- Stubbed integration: code surface exists, but provider wiring is still placeholder or mock-first.

## Suggested Reading Order

If you want to understand the repo quickly, read in this order:

1. [README.md](../README.md)
2. [packages/db/prisma/schema.prisma](../packages/db/prisma/schema.prisma)
3. [apps/api/src/app/api/v1](../apps/api/src/app/api/v1)
4. [apps/ops/src/app](../apps/ops/src/app)
5. [apps/borrower/src/app](../apps/borrower/src/app)
6. [apps/partner/src/app](../apps/partner/src/app)
7. [apps/workers/src/index.ts](../apps/workers/src/index.ts)
8. [packages](../packages)

## Monorepo Shape

### Apps

- [apps/api](../apps/api): Next.js API application that exposes the lending, borrower, collections, reporting, KYC, and document endpoints.
- [apps/borrower](../apps/borrower): borrower-facing portal for sign-up, sign-in, applications, dashboard, and downloads.
- [apps/ops](../apps/ops): internal operations console for underwriting, portfolio oversight, compliance, collections, and reports.
- [apps/partner](../apps/partner): partner-facing portal for partner sign-in, product browsing, application submission, and API-key-related UI.
- [apps/workers](../apps/workers): Inngest worker process for scheduled and async jobs.

### Shared Packages

- [packages/db](../packages/db): Prisma client and schema.
- [packages/ledger](../packages/ledger): money, schedules, accrual, payment allocation, IFRS 9.
- [packages/pricing](../packages/pricing): affordability, policy, pricing, amortization.
- [packages/ai](../packages/ai): AI-oriented helpers and agent surfaces.
- [packages/kyc](../packages/kyc): KYC, sanctions, bureau, Smile ID, address verification, KYB.
- [packages/integrations](../packages/integrations): banking and payout integrations.

## Borrower App

Primary files: [apps/borrower/src/app](../apps/borrower/src/app), [apps/borrower/src/components](../apps/borrower/src/components), [apps/borrower/src/lib/session.ts](../apps/borrower/src/lib/session.ts)

### Implemented pages

- [apps/borrower/src/app/page.tsx](../apps/borrower/src/app/page.tsx): marketing landing page with the interactive mesh hero, CTA links, and a demo loan preview card.
- [apps/borrower/src/app/sign-up/page.tsx](../apps/borrower/src/app/sign-up/page.tsx): borrower registration flow that creates a borrower through the API, then signs the borrower in. This is hybrid because it also includes demo/test autofill.
- [apps/borrower/src/app/sign-in/page.tsx](../apps/borrower/src/app/sign-in/page.tsx): borrower email sign-in flow backed by the borrower auth API. This is hybrid because the copy and session model are still demo-oriented.
- [apps/borrower/src/app/apply/page.tsx](../apps/borrower/src/app/apply/page.tsx): multi-step application flow that fetches products, collects loan details, runs the Smile ID preview step, and submits an application.
- [apps/borrower/src/app/dashboard/page.tsx](../apps/borrower/src/app/dashboard/page.tsx): borrower dashboard that starts with demo loans and applications, then attempts live API reads in the background.
- [apps/borrower/src/app/downloads/page.tsx](../apps/borrower/src/app/downloads/page.tsx): borrower downloads area for statements and agreements with API fetches plus demo fallback if the API is unavailable.

### Borrower-specific implemented behavior

- Session storage and timeout handling exist via [apps/borrower/src/lib/session.ts](../apps/borrower/src/lib/session.ts) and [apps/borrower/src/proxy.ts](../apps/borrower/src/proxy.ts).
- Product discovery is already wired to [apps/api/src/app/api/v1/products/route.ts](../apps/api/src/app/api/v1/products/route.ts).
- Application submission is already wired to [apps/api/src/app/api/v1/applications/route.ts](../apps/api/src/app/api/v1/applications/route.ts).
- Borrower creation and borrower auth are already wired to [apps/api/src/app/api/v1/borrowers/route.ts](../apps/api/src/app/api/v1/borrowers/route.ts) and [apps/api/src/app/api/v1/auth/borrower/route.ts](../apps/api/src/app/api/v1/auth/borrower/route.ts).
- The borrower hero background now has both animated canvas rendering and a static SVG fallback via [apps/borrower/src/components/HeroSection.jsx](../apps/borrower/src/components/HeroSection.jsx) and [apps/borrower/src/components/MeshPatternOverlay.jsx](../apps/borrower/src/components/MeshPatternOverlay.jsx).

### Borrower areas still demo-oriented

- [apps/borrower/src/app/_components/SmileIdDemo.tsx](../apps/borrower/src/app/_components/SmileIdDemo.tsx): explicit demo-only identity flow.
- [apps/borrower/src/app/dashboard/page.tsx](../apps/borrower/src/app/dashboard/page.tsx): loads with fixture loans and applications before any live fetch succeeds.
- [apps/borrower/src/app/downloads/page.tsx](../apps/borrower/src/app/downloads/page.tsx): retains a demo loan fallback.
- Sign-up still includes one-click demo/test data fill.

Overall status: Hybrid MVP.

## Ops App

Primary files: [apps/ops/src/app](../apps/ops/src/app), [apps/ops/src/lib](../apps/ops/src/lib)

### Live-backed ops pages

- [apps/ops/src/app/page.tsx](../apps/ops/src/app/page.tsx): portfolio command center backed by the dashboard API for book size, PAR, NPL, disbursement velocity, AI performance, and cohorts.
- [apps/ops/src/app/applications/page.tsx](../apps/ops/src/app/applications/page.tsx): queue view with live filtering, search, sorting, approval, rejection, assignment, and flagging.
- [apps/ops/src/app/applications/[id]/page.tsx](../apps/ops/src/app/applications/[id]/page.tsx): application detail page with live load, approve/reject actions, bureau pull, and event posting.
- [apps/ops/src/app/collections/page.tsx](../apps/ops/src/app/collections/page.tsx): collections workbench backed by the collections API for delinquency review and collection-event submission.
- [apps/ops/src/app/kyc/page.tsx](../apps/ops/src/app/kyc/page.tsx): compliance queue backed by the compliance API with search, risk filters, and CSV export.
- [apps/ops/src/app/reports/page.tsx](../apps/ops/src/app/reports/page.tsx): live reporting UI for portfolio summary and regulatory report types.

### Hybrid ops pages

- [apps/ops/src/app/sign-in/page.tsx](../apps/ops/src/app/sign-in/page.tsx): internal staff sign-in with staged auth modes, live staff auth endpoint support, and demo fallback support.
- [apps/ops/src/app/applications/new/page.tsx](../apps/ops/src/app/applications/new/page.tsx): manual application creation flow that fetches products, creates a borrower, and submits an application, but still uses demo authorization headers.
- [apps/ops/src/app/downloads/page.tsx](../apps/ops/src/app/downloads/page.tsx): support/downloads UI that still leans on demo authorization.
- [apps/ops/src/app/settings/page.tsx](../apps/ops/src/app/settings/page.tsx): settings page documents staged auth rollout and operational configuration but is not a full live admin console yet.

### Demo-backed ops pages

- [apps/ops/src/app/loans/page.tsx](../apps/ops/src/app/loans/page.tsx): uses demo fixture loans.
- [apps/ops/src/app/loans/[id]/page.tsx](../apps/ops/src/app/loans/[id]/page.tsx): uses local demo detail data and generated schedules instead of live loan detail fetches.

### Ops-specific infrastructure already implemented

- Same-origin API proxying lives under [apps/ops/src/app/api/proxy](../apps/ops/src/app/api/proxy) to avoid direct client-side dependency on the API origin.
- Signed internal auth and bearer-token construction live under [apps/ops/src/lib](../apps/ops/src/lib), including fallback/demo support and shared secret validation.
- Shared authenticated shell and mesh background live in [apps/ops/src/app/_components/OpsLayout.tsx](../apps/ops/src/app/_components/OpsLayout.tsx), [apps/ops/src/app/_components/InteractiveMeshSurface.tsx](../apps/ops/src/app/_components/InteractiveMeshSurface.tsx), and [apps/ops/src/app/_components/MeshPatternOverlay.tsx](../apps/ops/src/app/_components/MeshPatternOverlay.tsx).

Overall status: Mostly live-backed, with loans/settings/auth transition areas still hybrid or demo-backed.

## Partner App

Primary files: [apps/partner/src/app](../apps/partner/src/app), [apps/partner/src/lib/session.ts](../apps/partner/src/lib/session.ts)

### Implemented pages

- [apps/partner/src/app/page.tsx](../apps/partner/src/app/page.tsx): partner landing page.
- [apps/partner/src/app/sign-in/page.tsx](../apps/partner/src/app/sign-in/page.tsx): partner sign-in using the partner auth API.
- [apps/partner/src/app/products/page.tsx](../apps/partner/src/app/products/page.tsx): product catalog that fetches available products from the API.
- [apps/partner/src/app/applications/new/page.tsx](../apps/partner/src/app/applications/new/page.tsx): multi-step partner submission flow that creates a borrower and submits an application through the API.
- [apps/partner/src/app/applications/page.tsx](../apps/partner/src/app/applications/page.tsx): partner applications table.
- [apps/partner/src/app/loans/page.tsx](../apps/partner/src/app/loans/page.tsx): partner loans view.
- [apps/partner/src/app/reports/page.tsx](../apps/partner/src/app/reports/page.tsx): partner report view.
- [apps/partner/src/app/api-keys/page.tsx](../apps/partner/src/app/api-keys/page.tsx): API-key management UI.
- [apps/partner/src/app/settings/page.tsx](../apps/partner/src/app/settings/page.tsx): partner settings page.

### What is real versus preview in the partner app

- Real API hooks already exist for sign-in, products, borrower creation, and application submission.
- [apps/partner/src/app/products/page.tsx](../apps/partner/src/app/products/page.tsx) and [apps/partner/src/app/applications/new/page.tsx](../apps/partner/src/app/applications/new/page.tsx) are the strongest live-integrated partner surfaces.
- [apps/partner/src/app/applications/page.tsx](../apps/partner/src/app/applications/page.tsx), [apps/partner/src/app/loans/page.tsx](../apps/partner/src/app/loans/page.tsx), [apps/partner/src/app/reports/page.tsx](../apps/partner/src/app/reports/page.tsx), and [apps/partner/src/app/api-keys/page.tsx](../apps/partner/src/app/api-keys/page.tsx) still run primarily on fixture/demo state.
- [apps/partner/src/app/settings/page.tsx](../apps/partner/src/app/settings/page.tsx) explicitly documents demo-mode assumptions.

Overall status: Mostly demo-backed UI with real submission and product hooks.

## API App

Primary files: [apps/api/src/app/api/v1](../apps/api/src/app/api/v1), [apps/api/src/lib](../apps/api/src/lib)

### Implemented endpoint inventory

#### Auth

- [apps/api/src/app/api/v1/auth/borrower/route.ts](../apps/api/src/app/api/v1/auth/borrower/route.ts)
- [apps/api/src/app/api/v1/auth/partner/route.ts](../apps/api/src/app/api/v1/auth/partner/route.ts)
- [apps/api/src/app/api/v1/auth/staff/route.ts](../apps/api/src/app/api/v1/auth/staff/route.ts)

#### Applications

- [apps/api/src/app/api/v1/applications/route.ts](../apps/api/src/app/api/v1/applications/route.ts)
- [apps/api/src/app/api/v1/applications/[id]/route.ts](../apps/api/src/app/api/v1/applications/[id]/route.ts)
- [apps/api/src/app/api/v1/applications/[id]/approve/route.ts](../apps/api/src/app/api/v1/applications/[id]/approve/route.ts)
- [apps/api/src/app/api/v1/applications/[id]/reject/route.ts](../apps/api/src/app/api/v1/applications/[id]/reject/route.ts)
- [apps/api/src/app/api/v1/applications/[id]/bureau-pull/route.ts](../apps/api/src/app/api/v1/applications/[id]/bureau-pull/route.ts)
- [apps/api/src/app/api/v1/applications/[id]/events/route.ts](../apps/api/src/app/api/v1/applications/[id]/events/route.ts)

#### Borrowers

- [apps/api/src/app/api/v1/borrowers/route.ts](../apps/api/src/app/api/v1/borrowers/route.ts)
- [apps/api/src/app/api/v1/borrowers/[id]/route.ts](../apps/api/src/app/api/v1/borrowers/[id]/route.ts)
- [apps/api/src/app/api/v1/borrowers/[id]/transactions/route.ts](../apps/api/src/app/api/v1/borrowers/[id]/transactions/route.ts)
- [apps/api/src/app/api/v1/borrowers/[id]/ops-history/route.ts](../apps/api/src/app/api/v1/borrowers/[id]/ops-history/route.ts)

#### Loans and servicing

- [apps/api/src/app/api/v1/loans/route.ts](../apps/api/src/app/api/v1/loans/route.ts)
- [apps/api/src/app/api/v1/loans/disburse/route.ts](../apps/api/src/app/api/v1/loans/disburse/route.ts)
- [apps/api/src/app/api/v1/loans/setup-repayment/route.ts](../apps/api/src/app/api/v1/loans/setup-repayment/route.ts)
- [apps/api/src/app/api/v1/loans/[id]/route.ts](../apps/api/src/app/api/v1/loans/[id]/route.ts)
- [apps/api/src/app/api/v1/loans/[id]/statement/route.ts](../apps/api/src/app/api/v1/loans/[id]/statement/route.ts)
- [apps/api/src/app/api/v1/loans/[id]/agreement/route.ts](../apps/api/src/app/api/v1/loans/[id]/agreement/route.ts)
- [apps/api/src/app/api/v1/loans/[id]/ops-report/route.ts](../apps/api/src/app/api/v1/loans/[id]/ops-report/route.ts)
- [apps/api/src/app/api/v1/loans/[id]/restructure/route.ts](../apps/api/src/app/api/v1/loans/[id]/restructure/route.ts)
- [apps/api/src/app/api/v1/loans/[id]/early-repay/route.ts](../apps/api/src/app/api/v1/loans/[id]/early-repay/route.ts)

#### Operations and monitoring

- [apps/api/src/app/api/v1/dashboard/route.ts](../apps/api/src/app/api/v1/dashboard/route.ts)
- [apps/api/src/app/api/v1/compliance/route.ts](../apps/api/src/app/api/v1/compliance/route.ts)
- [apps/api/src/app/api/v1/collections/route.ts](../apps/api/src/app/api/v1/collections/route.ts)
- [apps/api/src/app/api/v1/reports/route.ts](../apps/api/src/app/api/v1/reports/route.ts)
- [apps/api/src/app/api/v1/underwriting/route.ts](../apps/api/src/app/api/v1/underwriting/route.ts)

#### Products, credentials, documents, and provider hooks

- [apps/api/src/app/api/v1/products/route.ts](../apps/api/src/app/api/v1/products/route.ts)
- [apps/api/src/app/api/v1/api-credentials/route.ts](../apps/api/src/app/api/v1/api-credentials/route.ts)
- [apps/api/src/app/api/v1/api-credentials/[id]/route.ts](../apps/api/src/app/api/v1/api-credentials/[id]/route.ts)
- [apps/api/src/app/api/v1/documents/upload-url/route.ts](../apps/api/src/app/api/v1/documents/upload-url/route.ts)
- [apps/api/src/app/api/v1/stitch/link-token/route.ts](../apps/api/src/app/api/v1/stitch/link-token/route.ts)
- [apps/api/src/app/api/v1/stitch/webhook/route.ts](../apps/api/src/app/api/v1/stitch/webhook/route.ts)
- [apps/api/src/app/api/v1/kyc/initiate/route.ts](../apps/api/src/app/api/v1/kyc/initiate/route.ts)
- [apps/api/src/app/api/v1/kyc/webhook/route.ts](../apps/api/src/app/api/v1/kyc/webhook/route.ts)
- [apps/api/src/app/api/v1/kyc-checks/route.ts](../apps/api/src/app/api/v1/kyc-checks/route.ts)

### Important implemented API behavior

- Application submission supports idempotency and includes NCA disclosure information in the response.
- The ops applications list supports queue filtering, sorting, search, status counts, review-derived workflow status, and lender scoping.
- Dashboard and compliance endpoints are genuinely database-backed and power live ops screens.
- Regulatory and portfolio reporting is implemented in [apps/api/src/app/api/v1/reports/route.ts](../apps/api/src/app/api/v1/reports/route.ts).
- Multi-rail disbursement lives in [apps/api/src/lib/disbursement.ts](../apps/api/src/lib/disbursement.ts).
- Notification fan-out exists in [apps/api/src/lib/notifications.ts](../apps/api/src/lib/notifications.ts).
- Ops auth tokens and verification live in [apps/api/src/lib/ops-access-token.ts](../apps/api/src/lib/ops-access-token.ts) and [apps/api/src/lib/ops-auth.ts](../apps/api/src/lib/ops-auth.ts).

### Important API caveats

- Some endpoints are fully live-backed only when database and provider environment variables are present.
- Staff auth deliberately keeps a demo path in [apps/api/src/app/api/v1/auth/staff/route.ts](../apps/api/src/app/api/v1/auth/staff/route.ts).
- Notifications, some payment rails, and several provider integrations still default to stub or mock behavior in the supporting library code.

Overall status: broad backend surface with a mix of live-backed domain logic and provider stubs.

## Workers

Primary files: [apps/workers/src/index.ts](../apps/workers/src/index.ts), [apps/workers/src/jobs](../apps/workers/src/jobs), [apps/workers/src/inngest/functions](../apps/workers/src/inngest/functions)

### Implemented jobs

- [apps/workers/src/jobs/daily-accrual.ts](../apps/workers/src/jobs/daily-accrual.ts): daily loan accrual processing.
- [apps/workers/src/jobs/update-delinquency.ts](../apps/workers/src/jobs/update-delinquency.ts): delinquency and DPD updates.
- [apps/workers/src/jobs/payment-reminders.ts](../apps/workers/src/jobs/payment-reminders.ts): reminder job.
- [apps/workers/src/jobs/retry-payments.ts](../apps/workers/src/jobs/retry-payments.ts): payment retry workflow.
- [apps/workers/src/jobs/retry-webhooks.ts](../apps/workers/src/jobs/retry-webhooks.ts): webhook retry workflow.
- [apps/workers/src/inngest/functions/underwrite.ts](../apps/workers/src/inngest/functions/underwrite.ts): async underwriting trigger.

### Worker runtime

- [apps/workers/src/index.ts](../apps/workers/src/index.ts) hosts an Inngest HTTP handler and registers the functions above.

Overall status: implemented Inngest worker runtime with core scheduled jobs registered.

## Shared Packages

### @capstack/db

Primary files: [packages/db/prisma/schema.prisma](../packages/db/prisma/schema.prisma), [packages/db/index.ts](../packages/db/index.ts)

Implemented data domains include:

- Multi-tenant lenders, partners, staff, and API credentials.
- Borrowers for both individual and business applicants.
- Loan products and pricing metadata.
- Applications, application events, and credit decisions.
- Loans, schedules, repayments, disbursements, and ledger accounts.
- KYC checks, AML alerts, consent records, and borrower documents.
- Bank-account and bank-transaction records.
- Collection events and compliance/reporting-related entities.

### @capstack/ledger

Primary files: [packages/ledger/src](../packages/ledger/src)

Implemented modules include:

- [packages/ledger/src/money.ts](../packages/ledger/src/money.ts): cents-based immutable money type.
- [packages/ledger/src/ledger-entry.ts](../packages/ledger/src/ledger-entry.ts): double-entry primitives and transaction builder.
- [packages/ledger/src/amortization.ts](../packages/ledger/src/amortization.ts): loan schedule generation.
- [packages/ledger/src/accrual.ts](../packages/ledger/src/accrual.ts): daily accrual helpers.
- [packages/ledger/src/payment-allocation.ts](../packages/ledger/src/payment-allocation.ts): repayment allocation.
- [packages/ledger/src/ifrs9.ts](../packages/ledger/src/ifrs9.ts): expected-credit-loss calculations.

### @capstack/pricing

Primary files: [packages/pricing/src](../packages/pricing/src)

Implemented modules include:

- [packages/pricing/src/affordability.ts](../packages/pricing/src/affordability.ts)
- [packages/pricing/src/amortization.ts](../packages/pricing/src/amortization.ts)
- [packages/pricing/src/policy.ts](../packages/pricing/src/policy.ts)
- [packages/pricing/src/pricing.ts](../packages/pricing/src/pricing.ts)

These cover affordability checks, policy-rule evaluation, pricing by risk band, and repayment schedule calculations.

### @capstack/ai

Primary files: [packages/ai/src](../packages/ai/src)

Implemented code surfaces include:

- [packages/ai/src/statement-parser.ts](../packages/ai/src/statement-parser.ts)
- [packages/ai/src/collections-agent.ts](../packages/ai/src/collections-agent.ts)
- [packages/ai/src/aml-detector.ts](../packages/ai/src/aml-detector.ts)
- [packages/ai/src/onboarding-agent.ts](../packages/ai/src/onboarding-agent.ts)
- [packages/ai/src/fraud-detector.ts](../packages/ai/src/fraud-detector.ts)

These modules exist and are usable in code, but several still rely on heuristics, local state, or placeholder LLM logic.

### @capstack/kyc

Primary files: [packages/kyc/src](../packages/kyc/src)

Implemented code surfaces include:

- [packages/kyc/src/onfido.ts](../packages/kyc/src/onfido.ts)
- [packages/kyc/src/smile-id.ts](../packages/kyc/src/smile-id.ts)
- [packages/kyc/src/sanctions.ts](../packages/kyc/src/sanctions.ts)
- [packages/kyc/src/credit-bureau.ts](../packages/kyc/src/credit-bureau.ts)
- [packages/kyc/src/address-verification.ts](../packages/kyc/src/address-verification.ts)
- [packages/kyc/src/kyb.ts](../packages/kyc/src/kyb.ts)

These modules define the KYC and bureau surface area, but several remain provider-stubbed or mock-first.

### @capstack/integrations

Primary files: [packages/integrations/src/stitch.ts](../packages/integrations/src/stitch.ts)

Implemented code surfaces include:

- Link-token creation surface.
- Mock transaction retrieval.
- Mock payout fallback support.

Overall status: present integration boundary, but not fully live provider wiring.

## Compliance and Lending Rules Already Reflected in Code

- NCA disclosure calculation is included during application submission.
- Early repayment handling has a dedicated servicing route.
- IFRS 9 and ECL calculations exist in the ledger/reporting layer.
- Compliance, sanctions, AML, and KYC review all have explicit schema and API surfaces.
- Audit/event-driven workflow is embedded into applications, collections, and compliance flows.

## Live, Hybrid, and Demo Summary

### Mostly live-backed today

- API domain routes under [apps/api/src/app/api/v1](../apps/api/src/app/api/v1)
- Ops dashboard, applications queue, application detail, compliance queue, collections, and reports
- Worker registration and scheduled job framework
- Core schema, ledger, pricing, and much of the servicing logic

### Hybrid today

- Borrower sign-up, sign-in, application flow, dashboard, and downloads
- Ops sign-in, manual application creation, and some support pages
- Partner sign-in and partner application submission flow

### Mostly demo-backed today

- Borrower Smile ID UI flow
- Ops loans list and loan detail pages
- Partner applications list, loans, reports, API-key management, and settings pages

### Stubbed or mock-first integrations today

- Notifications live delivery channels
- Parts of PayFast, Stitch, and Stripe disbursement or repayment rails
- Onfido, Smile ID, sanctions, address verification, and KYB provider implementations
- Several AI and agent workflows

## If You Need the Fastest Code Walkthrough

Start here:

1. [packages/db/prisma/schema.prisma](../packages/db/prisma/schema.prisma)
2. [apps/api/src/app/api/v1/applications/route.ts](../apps/api/src/app/api/v1/applications/route.ts)
3. [apps/api/src/app/api/v1/dashboard/route.ts](../apps/api/src/app/api/v1/dashboard/route.ts)
4. [apps/api/src/app/api/v1/compliance/route.ts](../apps/api/src/app/api/v1/compliance/route.ts)
5. [apps/ops/src/app/applications/page.tsx](../apps/ops/src/app/applications/page.tsx)
6. [apps/borrower/src/app/apply/page.tsx](../apps/borrower/src/app/apply/page.tsx)
7. [apps/partner/src/app/applications/new/page.tsx](../apps/partner/src/app/applications/new/page.tsx)
8. [apps/workers/src/index.ts](../apps/workers/src/index.ts)

That set gives you the core lending loop, operations surface, partner intake path, and background processing entry point.
