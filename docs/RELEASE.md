# Release QA report

Date: 2026-11-01. Scope: the complete local sandbox currently in the repository. This report records what was executed and observed. It is not a production-readiness certification.

## Executive summary

ATLAS now covers four surfaces around one ledger:

1. **Public** marketing, pricing, security, developer documentation and rendered `/docs`.
2. **Personal** banking for a multi-currency customer.
3. **Business** finance with organization roles, maker-checker approvals and developer keys.
4. **Operations** with customers, support, risk, compliance, reconciliation, ledger, audit, integrations, health and permissions.

The build compiles, the test suite passes, lint is clean and an authenticated production server was exercised across the main routes. Browser end-to-end, accessibility, visual-regression, performance and independent security testing remain outstanding.

## Batch history

### Batch 1 — Foundation

- Next.js App Router, strict TypeScript, Tailwind v4, Radix primitives, Motion, TanStack Query, React Hook Form/Zod, Recharts, Lucide and `next-themes`.
- Semantic token system, marketing pages, app shell and shared UI primitives.
- SQLite schema, migration runner, deterministic seed and local client.
- Money, FX, ledger, RBAC, identity and access domains.
- scrypt password/PIN hashing, hashed opaque sessions, eight-hour expiry and process-local rate limits.
- Personal and business services and routes.

### Batch 2 — Financial safety and read API

- `002_ledger_guards.sql` protects posted journals, postings and audit events.
- Atomic idempotency, holds, settlement, FX quotes, reversals and reconciliation.
- Read-only bearer API at `/api/v1/[...resource]`.
- Hashed, owner-scoped, revocable and rate-limited API keys.
- Regression tests for money, journals, idempotency, holds, FX and API boundaries.

### Batch 3 — Personal and business workspaces

- Dedicated personal routes: accounts, transactions, transfers, FX, cards, budgets, goals, bills, insights, beneficiaries, settings.
- Dedicated business routes: invoices, bills, vendors, approvals, expenses, cards, team, reports, developers.
- Organization switching and maker-checker approval decisions.
- Server actions enforce permission and ownership.

### Batch 4 — Operations console

- Replaced the generic `[view]` table with dedicated routes.
- Added audited risk, compliance, support, reconciliation, ledger correction, settlement and webhook replay actions.
- Sensitive actions require permission and, where financial or case-related, the authorization PIN.

### Batch 5 — Documentation and hardening

- `/docs` and `/docs/[slug]` render repository markdown through `marked`.
- Added architecture, ledger, RBAC, design system, implementation, backlog, QA and portfolio documents.
- Added API key revocation UI.
- Added operations settlement for processing payouts.
- Added `db:reset` with a timestamped backup before rebuilding the local database.
- Removed unused imports, dead files and stale actions; lint is clean.

## Automated verification

| Command | Result | Notes |
|---|---|---|
| `npm run typecheck` | **PASS** | `tsc --noEmit`, no errors |
| `npm test` | **PASS** | 41 tests across 4 files |
| `npm run build` | **PASS** | Optimized production build; all routes compiled |
| `npm run lint` | **PASS** | 0 errors, 0 warnings |

Known non-fatal advisories:

- Turbopack reports a dynamic filesystem access warning in `src/db/migrate.ts` because the migration directory is read at runtime.
- Vitest reports that `vitest.config.ts` is ESM loaded as CommonJS. Tests still pass.

### Test files

| File | Coverage |
|---|---|
| `src/domain/finance.test.ts` | Money precision, journal balance, idempotency replay/conflict, insufficient funds, holds, settlement, FX expiry, reversals, database guards, API key hashing, reconciliation authorization |
| `src/server/api.test.ts` | HTTP authentication, ownership, staff denial, pagination validation, immediate revocation |
| `src/server/ops.test.ts` | Operations permissions, risk/compliance/support decisions, reconciliation resolution, reversals, adjustments, webhook replay, payout settlement |
| `src/server/workflows.test.ts` | FX conversion, external FX rejection, maker-checker role order, PIN/comment requirements, self-approval rejection, RBAC matrix |

## Runtime smoke checks

A production server was started with `npm start` and exercised with an authenticated admin session.

- Public pages `/`, `/pricing`, `/security`, `/developers`, `/login` return `200`.
- `/docs` and all nine documentation slugs render `200`.
- Authenticated `/app`, `/business` and `/ops` routes return `200`.
- All thirteen operations routes render, including journal and customer detail pages.
- Unauthenticated operations routes redirect to sign-in.
- The API returns structured `401` responses without a key.
- Organization switching and sign-out were exercised through the server actions.

These are HTTP and server-action checks, not a full browser workflow test. No screenshots, accessibility scores or performance traces were collected.

## Release quality matrix

PASS indicates only the stated evidence, never commercial readiness.

| Area | Status | Evidence / limit |
|---|---|---|
| Authentication | PARTIAL | Login, session, sign-out and API key checks exercised; no browser lifecycle or MFA test |
| Role enforcement | PASS | Unit, API and workflow tests for platform and business permissions; full page/action matrix not exhaustively exercised |
| Account isolation | PASS | Customer account and API organization denial tests |
| Ledger balancing | PASS | Seed per-currency balance and unbalanced-journal rejection tests |
| Transfer idempotency | PASS | Same request replay, changed request conflict, one debit |
| Concurrent balance protection | NOT TESTED | Immediate write transaction exists; true concurrent clients not exercised |
| Financial transaction states | PASS | Processing hold, settlement, repeated settlement and reversal tests; all states not exhaustive |
| FX calculations | PASS | Currency precision, deterministic conversion and expired quote tests |
| Payment integrations | BLOCKED | No live provider configured or authorized |
| Customer workspace | PARTIAL | Routes compile and render; browser interaction QA pending |
| Business operations | PARTIAL | Routes compile and render; maker-checker tested; full browser workflow pending |
| Risk/compliance workflows | PARTIAL | Guarded forms and service decisions tested; browser mutation tests pending |
| Reconciliation | PASS | Unauthorized caller rejected, authorized run persists, item resolution tested; offsetting discrepancies partial |
| Payout settlement | PASS | Operations settlement posts, captures the hold and rejects repeats |
| Responsive design | NOT TESTED | Responsive styles exist; no device/browser inspection |
| Accessibility | NOT TESTED | Labels, focus styles and semantic tables exist; axe/Lighthouse/screen-reader audit pending |
| Dark mode | NOT TESTED | Semantic themes exist; visual audit pending |
| Automated tests | PASS | 41 tests in 4 suites |
| Performance | NOT TESTED | No Core Web Vitals, bundle or load measurements |
| Security review | NOT TESTED | No independent audit or penetration test |
| Deployment readiness | BLOCKED | Local build succeeds; hosting, secrets, recovery and release gates incomplete |
| Documentation | PASS | Architecture, ledger, RBAC, design, blueprint, implementation, backlog, QA and portfolio recorded |

## Local recovery

Stop the server before copying files. `npm run db:reset` writes a timestamped `atlas.backup-*.db` beside the live database before deleting and rebuilding it. To restore, stop the server, move the backup into place, then start again. Do not manually edit posted financial rows; use the operations reversal workflow. Test recovery on a separate path through `DATABASE_PATH` and confirm migrations and journal balance before reuse.

## Remaining issues

- No browser E2E, accessibility, visual-regression or performance suite.
- No multiprocess concurrency or PostgreSQL isolation test.
- Process-local rate limiting and sessions.
- Synthetic providers, webhook deliveries and settlement only.
- No MFA/passkeys, CSP, managed secrets or independent security review.
- Broad synthetic staff customer visibility by design; production needs field-level redaction.
- The v1 API is read-only; external webhook delivery and API writes are not implemented.

## Release gate

Do not describe ATLAS as production-ready, compliant or safe for real money. Close the P0 items in `docs/BACKLOG.md`, record browser and accessibility evidence, and complete an independent review of authorization and money-movement boundaries first.
