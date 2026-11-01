# FINTECH ATLAS

A persistent fintech sandbox combining personal finance, business workflows and financial operations around a double-entry ledger.

**Simulation only.** All customers, accounts, balances, cards, quotes and payments are synthetic. No live providers are enabled.

## Run locally

Requires Node.js 22.11+ and npm. Run `npm ci`, then `npm run dev`. Open http://localhost:3000. The first database access applies migrations and seeds `data/atlas.db`. Set `DATABASE_PATH` to override its location. Keep the demo private.

Choose a persona at `/login`: `maya@atlas.demo` for personal finance, `jonas@atlas.demo` for business, or `admin@atlas.demo` for operations. Password: `atlas-demo-2026`. Sensitive-action PIN: `246810`.

## Verify

Run `npm run typecheck`, `npm test`, and `npm run build`. Use `npm start` for the production server. On restricted PowerShell systems use `npm.cmd`. Builds currently fetch Google Fonts and require network access. Tests use isolated in-memory databases.

For browser checks, run `npx playwright install chromium`, build the app, then run `npm run test:e2e`. Playwright starts a production server on port 3218 with a unique temporary SQLite database. It checks login/logout, revoked sessions, workspace routes, card freeze/limits and payout failure. Browser coverage is partial.

## Explore

- Personal: accounts, transactions, transfers, FX, simulated cards, budgets, goals and bills.
- Business: invoices, vendors, expenses, approvals, cards, team and reporting.
- Operations: customer/support records, risk/compliance decisions, reconciliation, ledger, audit and health.
- Developer sandbox: create/revoke read-only bearer keys at `/business/developers`.

Read API endpoints: `/api/v1/accounts`, `/api/v1/transactions`, `/api/v1/transfers`, `/api/v1/ledger/journals`, `/api/v1/health`. Send `Authorization: Bearer YOUR_KEY`. Keys inherit current owner permissions; ledger and health require staff roles. Use `org_id` for organization accounts/transactions, `limit` (1-100) and `offset` for account/transaction pagination, and `account_id` to filter transactions. Transfers support personal scope and limit only. API writes and external webhook delivery are not implemented.

## Financial foundations

Safe integer minor units, decimal FX, balanced currency-specific journals, immediate SQLite write transactions, atomic idempotency claims, holds before settlement, compensating reversals, and database-protected posted journals and audit events.

## Documentation

- [Architecture, permissions, ledger, design and backlog](docs/BLUEPRINT.md)
- [Batch evidence and release quality](docs/RELEASE.md)
- [Demonstration and portfolio discussion](docs/PORTFOLIO.md)

This retains the existing Next.js modular monolith and SQLite implementation. PostgreSQL, durable workers, browser/concurrency/security audits, advanced wealth/credit simulations and production deployment remain roadmap work. The full master prompt is not yet complete.
