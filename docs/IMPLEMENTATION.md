# Implementation report

Date: 2026-11-01. This report describes the code that exists in the repository. It separates tested behavior from sandbox limitations.

## Current system

ATLAS is a Next.js App Router application with React server components, server actions, SQLite persistence and a double-entry ledger. It has three signed-in workspaces:

- **Personal** for a customer's accounts, transfers, FX, cards, budgets, goals and bills.
- **Business** for organization treasury, invoices, bills, vendors, expenses, approvals, cards, team, reports and developer keys.
- **Operations** for customers, support, risk, compliance, reconciliation, the ledger, audit, integrations, health and permissions.

The public surface includes marketing pages, a sign-in page, a read-only API and rendered documentation.

## Batch history

### 1. Foundation

- Strict TypeScript, Tailwind, Radix primitives, Motion, TanStack Query, React Hook Form/Zod, Recharts, Lucide and `next-themes`.
- Semantic token system in `src/app/globals.css`.
- SQLite schema, migration runner, deterministic seed and local database client.
- Money, FX, ledger, RBAC, access and identity domains.
- Custom scrypt password/PIN hashing, opaque hashed sessions, eight-hour expiry and process-local rate limits.
- Personal and business routes and services.

### 2. Financial safety and read API

- `src/db/migrations/002_ledger_guards.sql` protects posted journals, postings and audit events.
- Atomic idempotency claims, holds, settlement, FX quotes, reversals and reconciliation.
- `src/server/api.ts` and `/api/v1/[...resource]` provide read-only bearer-key access.
- API keys are SHA-256 hashed, owner-scoped, revocable and rate-limited.
- Regression tests for money precision, journal balance, idempotency, holds, settlement, FX and API boundaries.

### 3. Personal and business workspaces

- Dedicated personal routes for accounts, transactions, transfers, FX, cards, budgets, goals, bills, insights, beneficiaries and settings.
- Dedicated business routes for invoices, bills, vendors, approvals, expenses, cards, team, reports and developers.
- Organization switching and maker-checker approval decisions.
- Forms use server actions with permission and ownership checks.

### 4. Operations console

The generic `[view]` table was replaced with dedicated routes:

| Route | Purpose |
|---|---|
| `/ops` | Overview, attention queue, platform pulse and audit activity |
| `/ops/customers` | Searchable customer directory |
| `/ops/customers/[id]` | Customer 360 with balances, cases, risk and transactions |
| `/ops/support` | Support queue with status and priority updates |
| `/ops/risk` | Risk signals and audited review decisions |
| `/ops/compliance` | Compliance cases and audited decisions |
| `/ops/reconciliation` | Run reconciliation, inspect items and record resolutions |
| `/ops/ledger` | Journal inspector, filters and controlled adjustments |
| `/ops/ledger/[id]` | Posting detail, balance check and reversal form |
| `/ops/audit` | Filterable immutable audit trail |
| `/ops/integrations` | Provider events, processing payouts, settlement and webhook replay |
| `/ops/health` | SQLite integrity, ledger balance and runtime checks |
| `/ops/permissions` | Executable platform and organization permission matrix |

Sensitive actions require the appropriate permission and, for financial or case decisions, the authorization PIN. Actions write audit events.

### 5. Documentation and hardening

- `/docs` and `/docs/[slug]` render `docs/*.md` through `marked`.
- Added architecture, ledger, RBAC, design system, implementation, QA and backlog documents.
- Added API key revocation UI.
- Added operations settlement for processing payouts.
- Added `db:reset` with a timestamped backup before rebuilding the local database.
- Removed unused imports and dead files; lint is clean.

## Route inventory

```text
/                         /login                    /docs
/pricing                  /security                 /docs/[slug]
/developers

/app                      /app/accounts             /app/accounts/[id]
/app/transactions         /app/transactions/[id]    /app/transfers
/app/transfers/new        /app/transfers/[id]       /app/fx
/app/cards                /app/budgets              /app/goals
/app/bills                /app/insights             /app/beneficiaries
/app/settings

/business                 /business/invoices        /business/invoices/[id]
/business/bills           /business/vendors         /business/approvals
/business/approvals/[id]  /business/expenses        /business/cards
/business/team            /business/reports         /business/developers

/ops                      /ops/customers            /ops/customers/[id]
/ops/support              /ops/risk                 /ops/compliance
/ops/reconciliation       /ops/ledger               /ops/ledger/[id]
/ops/audit                /ops/integrations         /ops/health
/ops/permissions

/api/v1/[...resource]
```

## Test evidence

```text
npm run typecheck   pass
npm test            41 tests across 4 files, all pass
npm run build       pass
npm run lint        pass with 0 errors and 0 warnings
```

Test files:

| File | Coverage |
|---|---|
| `src/domain/finance.test.ts` | Money precision, journal balance, idempotency replay/conflict, insufficient funds, holds, settlement, FX expiry, reversals, database guards, API key hashing, reconciliation authorization |
| `src/server/api.test.ts` | HTTP authentication, ownership, staff denial, pagination validation and immediate revocation |
| `src/server/ops.test.ts` | Operations permissions, risk/compliance/support decisions, reconciliation resolution, reversals, adjustments, webhook replay, payout settlement |
| `src/server/workflows.test.ts` | Successful FX conversion, external FX rejection, maker-checker role order, PIN/comment requirements, self-approval rejection and the RBAC matrix |

Known non-fatal advisories:

- Turbopack reports a dynamic filesystem access warning in `src/db/migrate.ts` because the database path is configurable.
- Vitest reports that `vitest.config.ts` is ESM loaded as CommonJS; tests still pass.

## Runtime verification

An authenticated production server was exercised during development:

- All 13 operations routes returned HTTP 200 with an admin session.
- A journal detail page rendered its postings.
- Unauthenticated operations routes redirected to sign-in.
- The API returned structured `401` responses without a key.

Browser E2E, accessibility, visual regression and performance checks are not implemented. See `docs/RELEASE.md` for the current quality matrix.

## Security model

- Session tokens are opaque, hashed at rest and stored in HttpOnly cookies.
- Permissions are explicit strings checked on the server.
- Ownership is checked separately from permission.
- Business approvals enforce maker-checker and reject self-approval.
- Sensitive operations require a hashed PIN with rate limiting.
- Platform staff cannot move customer funds through customer accounts.
- API keys are hashed, revocable and read-only.
- The ledger rejects unbalanced journals and protects posted records with database triggers.

## Known limitations

- SQLite single-process writes; no multiprocess concurrency test.
- Process-local rate limiting.
- Synthetic providers, provider events and webhook deliveries.
- No real KYC, card issuing, payment network or FX liquidity.
- No browser E2E, a11y audit, visual regression or performance measurement.
- No independent security review.
- No production deployment, backup schedule or recovery drill.
- The v1 API is read-only by design.

## Non-claims

ATLAS does not hold or move real money, provide licensed financial services, issue usable cards or credentials, or satisfy a regulatory framework. It is a portfolio-grade simulation and must remain private and synthetic.
