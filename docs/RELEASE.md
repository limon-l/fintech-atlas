# Implementation evidence and release quality

Date: 2026-10-31. Scope: preserve and extend the supplied repository. The complete master prompt is not delivered; this is a tested foundation and operations/developer batch.

## Batch: financial safety and working operations

**Objective:** repair existing compilation; protect immutable financial records; supply regression tests; connect missing staff and developer routes.

**Files created:** `src/db/migrations/002_ledger_guards.sql`, `src/domain/finance.test.ts`, `src/server/api.ts`, `src/server/api.test.ts`, `src/app/api/v1/[...resource]/route.ts`, `src/app/actions/api-keys.ts`, `src/app/business/developers/page.tsx`, `src/app/ops/page.tsx`, `src/app/ops/[view]/page.tsx`, `src/components/app/api-key-form.tsx`, `src/components/app/ops-table.tsx`, and the three documents in `docs/`.

**Files modified:** `src/components/ui/misc.tsx`, `src/server/business.ts`, `src/domain/money.ts`, `src/domain/fx.ts`, `src/app/developers/page.tsx`, `.env.example`, `README.md`, and Next-generated TypeScript configuration updates in `tsconfig.json`.

**Frontend features:** operations overview; customer/support records; risk/compliance review forms; reconciliation action; ledger/audit/provider/health/permission views; developer key creation and revocation. Existing personal/business pages are retained, not newly claimed as implemented in this batch.

**Backend features:** validated staff actions; hashed-key read API; current-role and organization checks; process-local rate limiting; correlated JSON responses; bounded account/transaction pagination; key revocation and audit events.

**Database changes:** migration 002 blocks appending postings to final journals, directly inserting final journals, and editing/deleting audit events. Existing databases migrate on access.

**Financial invariant checks:** balance per journal/currency; exact parsing and conversion; safe running totals; duplicate transfer protection; changed-payload conflict; insufficient-funds rollback; hold reserve/capture; duplicate settlement rejection; quote expiration; compensating reversal; immutable posting/audit records.

**Security controls:** server-side staff permission guards; ownership checks; active hashed bearer keys; immediate revocation; no-store API responses; required review notes; immutable decision audit. No independent security review was performed.

**Tests executed:** `npm.cmd test` (19 tests across two files); `npm.cmd run typecheck`; `npm.cmd run build`. API boundary tests cover missing keys, customer isolation, denied staff endpoints, denied organization access, oversized limits and revocation.

**Actual results:** 19/19 tests pass. TypeScript and optimized production build pass. The first sandbox build failed fetching Google Fonts; retry with approved network access succeeded. Build reports a dynamic database-path tracing warning. Vitest reports an advisory about future native config loading. No dependencies were added.

Production-server HTTP smoke checks: homepage 200; login 200; unauthenticated operations 307 redirect; unauthenticated accounts API 401 with structured error, request correlation ID and `Cache-Control: no-store`. The verification server was stopped afterward. These checks do not constitute browser or authenticated workflow QA.

**Remaining issues:** no multiprocess concurrency test; no browser E2E/a11y/visual audit; no measured performance; broad synthetic staff visibility; process-local rate limiting; no production financial providers; no reliable external webhook worker; no PostgreSQL or deployment verification. Existing marketing links/content need a full route/claim audit. Developer keys use read-only HTTP endpoints; transfer submission remains a server-action UI workflow.

**Next batch:** fix reconciliation edge cases (including offsetting provider discrepancies), add concurrency and approval regression tests, perform authenticated browser walkthroughs, audit all links and marketing claims, then implement a durable provider/outbox boundary before expanding wealth or lending scope.

## Release quality matrix

PASS indicates only the stated evidence, never commercial readiness.

| Area | Status | Evidence / limit |
|---|---|---|
| Authentication | NOT TESTED | API key checks tested; full browser session lifecycle not tested |
| Role enforcement | PASS | Unit and API tests for denied staff and business permissions; full matrix not exhaustively exercised |
| Account isolation | PASS | Customer account and API organization denial tests |
| Ledger balancing | PASS | Seed per-currency balance and unbalanced-journal rejection tests |
| Transfer idempotency | PASS | Same request replay, changed request conflict, one debit |
| Concurrent balance protection | NOT TESTED | Immediate write transaction exists; true concurrent clients not exercised |
| Financial transaction states | PASS | Processing hold, settlement, repeated settlement and reversal tests; all states not exhaustive |
| FX calculations | PASS | Currency precision, deterministic conversion and expired quote tests |
| Payment integrations | BLOCKED | No live provider configured or authorized |
| Customer dashboard | NOT TESTED | Compiles; authenticated visual and interaction QA pending |
| Business operations | NOT TESTED | Existing routes compile; complete approval/payout tests pending |
| Risk/compliance workflows | NOT TESTED | New guarded forms compile; browser mutation tests pending |
| Reconciliation | PASS | Unauthorized caller rejected and authorized run persists; edge cases pending |
| Responsive design | NOT TESTED | Responsive styles exist; no device/browser inspection |
| Accessibility | NOT TESTED | Labels and semantic tables added; audit pending |
| Dark mode | NOT TESTED | Existing semantic themes preserved; visual audit pending |
| Automated tests | PASS | 19 tests in 2 suites |
| Performance | NOT TESTED | No Core Web Vitals, bundle or load measurements |
| Security review | NOT TESTED | No independent audit or penetration test |
| Deployment readiness | BLOCKED | Local build succeeds; persistent hosting, secrets, recovery and release gates incomplete |
| Documentation | PASS | Architecture, design, roles, ledger, roadmap, evidence and walkthrough recorded |

## Local recovery

Stop the server before backup. Copy the database and any WAL/SHM companions together, or use SQLite's backup API for a consistent online snapshot. Test recovery on a separate path through `DATABASE_PATH`; verify migrations and journal balance before reuse. Do not manually edit posted financial rows. `resetDb()` closes/reopens a connection; it is not a destructive data reset. Do not advertise the package's `db:reset` script as functional: its referenced source file is absent from the supplied repository.
