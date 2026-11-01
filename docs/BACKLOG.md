# Backlog

## How to read this

This is the honest remaining-work list for the sandbox. Items marked **blocked** require infrastructure or authority that is not present in the repository. Nothing here is a claim that the current build is production-ready.

## P0 — production safety and operations

| Item | Why it matters | Current state |
|---|---|---|
| PostgreSQL migration | SQLite immediate transactions serialize one local process; production needs row locking and isolation testing | Blocked by environment; migration path documented |
| Distributed rate limiting | Login, PIN and API limits are process-local | Not implemented |
| MFA / passkeys | The demo PIN is a step-up demonstration, not a second factor | Not implemented |
| Session management UI | Sessions expire and sign-out revokes the current token, but there is no device list or global revoke | Not implemented |
| Provider adapters | External payouts are simulated; no bank, card or FX provider is connected | Blocked |
| Durable outbox and workers | Webhook rows are a local queue; replay is simulated | Not implemented |
| Webhook signature verification | No external callbacks are received | Not implemented |
| Backups and restore drills | `db:reset` creates a timestamped backup, but there is no scheduled backup or recovery test | Partial |
| Observability | No structured logs, traces, metrics or alerting | Not implemented |
| CSP and security headers | Framework defaults only; no reviewed CSP | Not implemented |
| Independent security review | No penetration test or threat-model review | Not tested |

## P1 — verification and quality

| Item | Why it matters | Current state |
|---|---|---|
| Browser E2E tests | Unit tests do not prove forms, navigation and toasts work together | Not implemented |
| Accessibility audit | Labels and focus styles exist; no axe/Lighthouse/screen-reader pass | Not tested |
| Visual regression | Theme and responsive layouts have no screenshot baseline | Not implemented |
| Performance measurement | No Core Web Vitals, bundle or database timing data | Not tested |
| Multiprocess concurrency test | The ledger uses immediate transactions, but only one process is exercised | Not tested |
| Full RBAC exercise | The matrix is unit-tested; every page/action combination is not | Partial |
| Transfer cancellation | Processing transfers can be settled but not canceled through the UI | Not implemented |
| External payout failure flow | Operations form requires PIN and a reason; failure releases the hold with audit and notification | Implemented; browser verification pending |
| Reconciliation offset cases | Currency and per-transfer differences are counted; offsetting provider discrepancies need dedicated tests | Partial |
| Approval edge cases | Role order, self-approval, PIN and comments are tested; delegation and re-submission are not | Partial |
| Audit export | The audit trail is readable in the UI; there is no CSV/JSON export | Not implemented |
| API write surface | The v1 API is intentionally read-only | By design |

## P2 — product depth

| Item | Notes |
|---|---|
| Real statement import and matching | Requires a bank/provider integration and file parsing |
| Card issuing and controls | Cards are synthetic; numbers are unusable |
| Wealth and lending simulations | Not started; would need exact amortization and disclosure design |
| Multi-entity consolidation | One seeded organization only |
| Notifications preferences | Notifications are persisted, but delivery channels are not configurable |
| Internationalization | Copy and currency formatting are English-first |
| Marketing claim audit | Links and copy have been reviewed, but no automated link checker runs in CI |
| Storybook or component catalog | The design system is documented in markdown, not interactive |

## Completed in the current build

- Double-entry ledger with signed postings, per-currency balancing and database guards.
- Integer minor-unit money and decimal FX with deterministic rounding.
- Atomic idempotency claims, holds, settlement and compensating reversals.
- Server-enforced platform and organization permissions with ownership scoping.
- Maker-checker approvals with PIN and comment requirements.
- Personal, business and operations workspaces with dedicated routes.
- Operations decisions for risk, compliance, support, reconciliation, ledger corrections and webhook replay.
- Simulated payout settlement from the operations integrations console.
- Read-only bearer API with hashed keys, revocation and structured errors.
- Rendered documentation at `/docs`.
- Unit and integration tests for financial invariants, operations permissions, approvals, FX and API boundaries.

## Release gate

Do not call this production-ready until P0 items are resolved, browser and accessibility checks are recorded, and an independent review has examined the authorization and money-movement boundaries.
