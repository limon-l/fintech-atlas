# Architecture

## Scope

ATLAS is a local, persistent fintech simulation. It is a modular monolith built with Next.js App Router, React server components, server actions and SQLite. It demonstrates customer banking, business finance, maker-checker approvals, operations workflows, a read-only sandbox API and a double-entry ledger.

It does not hold or move real money, connect to a payment network, provide licensed financial services, or act as a production identity provider. The architecture is intentionally shaped like a real system so the financial and authorization boundaries are visible and testable.

## Runtime shape

```text
Browser
  -> Next.js App Router (server components, server actions)
  -> Session cookie (opaque token, hashed at rest)
  -> Server action / route handler
  -> Permission + ownership checks
  -> Domain service (transfers, business, personal, operations)
  -> Double-entry ledger (immediate SQLite transaction)
  -> SQLite database (WAL)
```

The UI never calculates a financial write. It submits validated form data to a server action, which resolves the current session, checks permissions and resource ownership, and calls a service. The service performs the write inside `writeTransaction`, which uses SQLite's immediate transaction mode to serialize writers in one process.

## Module map

| Path | Responsibility |
|---|---|
| `src/app` | Routes, layouts, server actions and route handlers |
| `src/components` | UI primitives, app shell, charts and feature components |
| `src/domain` | Money, FX, ledger, RBAC, access, identity and errors |
| `src/server` | Use cases for personal, business, transfers, operations and API auth |
| `src/db` | Migration runner, SQLite client, schema migrations and deterministic seed |
| `src/lib` | Session/auth helpers, rate limiting, docs loading and utilities |
| `src/**/*.test.ts` | Financial invariant and API boundary tests |

## Persistence

SQLite is used because the target environment has no Docker or PostgreSQL service. The database file lives at `data/atlas.db` by default and can be overridden with `DATABASE_PATH`.

Migrations are applied on first database access. The seed is deterministic and only runs when the `users` table is empty. This keeps local setup zero-step while avoiding accidental reseeding of an existing database.

Key tables:

- `users`, `sessions`, `memberships`, `organizations`
- `accounts`, `ledger_accounts`, `journal_entries`, `postings`
- `transfers`, `holds`, `beneficiaries`, `fx_quotes`, `idempotency_keys`
- `invoices`, `invoice_lines`, `invoice_payments`, `bills`, `vendors`, `expenses`
- `approval_requests`, `approval_steps`
- `risk_events`, `compliance_cases`, `reconciliation_runs`, `reconciliation_items`
- `provider_events`, `webhook_events`, `audit_events`, `support_tickets`
- `api_keys`, `notifications`, `cards`, `budgets`, `goals`

## Authentication and authorization

Sessions are opaque random tokens stored in an HttpOnly, SameSite=Lax cookie. Only the SHA-256 hash of the token is stored in `sessions`. Sessions expire after eight hours and can be revoked by sign-out.

Authorization is checked in two layers:

1. **Permission** — platform roles and organization roles map to explicit permission strings in `src/domain/rbac.ts`.
2. **Ownership** — account, transfer, invoice, bill, expense and approval queries filter by the authenticated user or organization.

Platform staff can read and review operations records. They are not granted customer fund-movement authority. Business approvals add maker-checker: the requester cannot decide their own request even if their role matches the current step.

## Money and the ledger

Amounts are safe integer minor units. Currency exponents are explicit, including zero-decimal and three-decimal currencies. FX rates are decimal strings and calculations use `decimal.js` with deterministic half-up rounding to the target currency.

Journal postings are signed: debit positive, credit negative. For every posted journal and currency, the postings must sum to zero. Customer liability balances are derived as `-SUM(postings)` for the customer's ledger account. Available funds equal ledger balance minus active holds.

The database enforces a second layer of protection with triggers:

- postings cannot be edited or deleted;
- posted journal entries cannot be edited;
- final journals cannot be inserted directly;
- an unbalanced journal cannot be finalized;
- audit events cannot be edited or deleted.

## Transfer flow

1. The composer builds a request and sends it to a server action.
2. The action verifies the session and PIN.
3. The transfer service computes a request hash and claims an idempotency key inside the same immediate transaction as the money movement.
4. Internal transfers post a balanced journal and complete immediately.
5. External transfers create an active hold and a `processing` transfer. A simulated settlement captures the hold and posts the payout journal.
6. FX transfers consume a persisted quote, post source and target clearing legs, and credit the destination Atlas wallet.
7. A repeated request with the same key and hash returns the stored response. A changed payload conflicts.

External FX payouts are intentionally rejected: FX converts between the customer's own Atlas wallets only.

## API

`/api/v1/[...resource]` is a read-only sandbox API authenticated with a bearer key. Keys are stored as SHA-256 hashes with a visible prefix. Responses use stable JSON error shapes, `Cache-Control: no-store` and a request correlation ID.

Implemented routes:

- `GET /api/v1/accounts`
- `GET /api/v1/transactions`
- `GET /api/v1/transfers`
- `GET /api/v1/ledger/journals`
- `GET /api/v1/health`

There is no HTTP endpoint that moves money. Transfer submission is a server-action UI workflow.

## Operations

The operations workspace has dedicated routes for customers, support, risk, compliance, reconciliation, ledger, audit, integrations, health and permissions. Sensitive decisions require a permission and, where financial or case integrity matters, the authorization PIN. Decisions write audit events.

Reconciliation compares posted external payouts with synthetic provider settlement events. Differences become explicit exception items. Resolving an item requires a note and updates the remaining exception count; it does not silently adjust the ledger.

## Failure and scale limits

- SQLite immediate transactions serialize writers in one process. There is no multi-process concurrency test.
- Rate limiting is process-local.
- Webhook rows are a local queue, not a reliable delivery service. Replay is simulated.
- Provider events are synthetic.
- There is no backup, recovery drill, telemetry pipeline or deployment verification.
- The read API is intentionally incomplete for financial writes.

## PostgreSQL migration path

The domain and service layers do not depend on SQLite-specific query syntax beyond migrations and a small number of pragmas. A production migration would:

1. Move schema to PostgreSQL with explicit `NUMERIC`/`BIGINT` types for money.
2. Replace immediate SQLite transactions with `SERIALIZABLE` or row-level locking.
3. Move rate limiting and sessions to shared storage.
4. Add a durable outbox and worker for provider events and webhooks.
5. Add provider adapters behind signed, idempotent interfaces.
6. Add observability, backups, restore drills and deployment controls.

None of those steps are implemented here.

## Verification

```bash
npm run typecheck
npm test
npm run build
npm run lint
```

The test suite covers money precision, journal balancing, transfer idempotency, holds, settlement, FX quotes, reversals, reconciliation, operations permissions and API authentication.
