# ATLAS — The Sandbox Fintech Operating System

**Customer banking, business finance, operations, and a double-entry ledger — designed as one coherent product.**

[![Next.js](https://img.shields.io/badge/Next.js-16.4.3-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.3.1-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![SQLite](https://img.shields.io/badge/SQLite-better--sqlite3-003B57?logo=sqlite&logoColor=white)](https://github.com/WiseLibs/better-sqlite3)
[![Tests](https://img.shields.io/badge/tests-57%20unit%20%2B%2010%20e2e-brightgreen)](#testing--verification)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Deployed on Vercel](https://img.shields.io/badge/deployed-Vercel-000000?logo=vercel)](https://fintech-atlas-omega.vercel.app/)

> [!IMPORTANT]
> **ATLAS is a synthetic sandbox.** It does not hold, move, or custody real money. It does not connect to a bank, card network, payment provider, or FX liquidity source. All customers, balances, cards, quotes, payouts, and provider events are deterministic demo data. Nothing here is a licensed financial service, a production identity provider, or a compliance certification.

---

## Table of Contents

- [Why ATLAS exists](#why-atlas-exists)
- [Live demo](#live-demo)
- [Feature highlights](#feature-highlights)
- [Screenshots](#screenshots)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [Demo accounts](#demo-accounts)
- [Environment variables](#environment-variables)
- [Available scripts](#available-scripts)
- [API reference](#api-reference)
- [Database](#database)
- [Authentication & authorization](#authentication--authorization)
- [Ledger & money model](#ledger--money-model)
- [Testing & verification](#testing--verification)
- [Deployment](#deployment)
- [Performance](#performance)
- [Security](#security)
- [Contributing](#contributing)
- [Roadmap](#roadmap)
- [License](#license)
- [Author](#author)
- [Acknowledgements](#acknowledgements)

---

## Why ATLAS exists

Most fintech demos show a dashboard. ATLAS shows the **system underneath it**.

The project explores a simple question: what does it look like when customer banking, company finance, maker-checker approvals, operations review, and a ledger are built as one product instead of disconnected screens?

Every balance in ATLAS is derived from signed ledger postings. Every money movement has an idempotency key, a state machine, and an audit trail. Every privileged action is checked on the server against a permission and, where it matters, an ownership rule and a step-up PIN.

It is built for:

- **Recruiters and hiring teams** evaluating full-stack product engineering and financial-system design.
- **Developers** who want a readable reference for double-entry ledgers, maker-checker workflows, and server-enforced RBAC in Next.js.
- **Designers** interested in a premium, responsive, accessible fintech interface.
- **Learners** who want to inspect how financial invariants are tested rather than claimed.

### What this is not

- Not a bank, neobank, wallet, or money transmitter.
- Not a production ledger — SQLite is single-process and rate limits are in-memory.
- Not connected to Stripe, Plaid, Wise, a card issuer, or any live provider.
- Not a claim of PCI DSS, SOC 2, KYC/AML, or regulatory compliance.
- Not a finished product. See the [roadmap](#roadmap) and [`docs/BACKLOG.md`](docs/BACKLOG.md).

---

## Live demo

| Environment | URL | Status |
|---|---|---|
| **Production (sandbox)** | [https://fintech-atlas-omega.vercel.app](https://fintech-atlas-omega.vercel.app/) | Live |
| **API base URL** | `https://fintech-atlas-omega.vercel.app/api/v1` | Read-only |
| **Staging** | — | Not configured |

**Demo password for every seeded account:** `atlas-demo-2026`  
**Step-up authorization PIN:** `246810`

> [!NOTE]
> The Vercel deployment uses SQLite at `/tmp/atlas.db` because the deployment filesystem is read-only. That database is **ephemeral and per-instance**: writes made in one serverless instance are not guaranteed to appear in another, and data resets when the instance is replaced. The local experience with a persistent `data/atlas.db` is the intended sandbox workflow.

---

## Feature highlights

### Public surface

| Feature | What exists |
|---|---|
| Marketing home | Product narrative, live ledger preview, persona cards, capability sections |
| Pricing | Sandbox plan comparison with explicit non-claims |
| Security | Security model, controls, and limitations |
| Developers | API overview and bearer-key quick start |
| Documentation | Nine repository markdown documents rendered at `/docs` through `marked` |
| Sign-in | Email/password login plus one-click demo personas grouped by Personal, Business, and Operations |

### Personal workspace (`/app`)

| Feature | What exists |
|---|---|
| Accounts | Multi-currency wallets, derived ledger balance, held funds, available balance, account detail pages |
| Transactions | Server-side search and filters, pagination, detail view with journal and money-flow trace |
| Transfers | Internal wallet-to-wallet, external bank/wallet payout, and FX conversion; idempotency key; PIN authorization; receipt page |
| FX studio | Indicative quote, explicit fee, effective rate, 90-second expiry, PIN-authorized conversion between owned wallets |
| Cards | Synthetic virtual cards, freeze/unfreeze, monthly and per-transaction limits with server validation |
| Budgets | Monthly category limits checked against posted spending, utilization, six-month net chart |
| Goals | Goal wallets backed by real ledger accounts, contributions, progress from live balances |
| Bills & recurring | Deterministic recurring-payment detection from repeated merchant activity over 120 days |
| Insights | Cashflow, category mix, top merchants, monthly net, reproducible analytics |
| Beneficiaries | Saved payout destinations with masked identifiers and audit on creation |
| Settings | Profile, KYC posture, notifications, active sessions, support request, security information |
| Atlas Assistant | Deterministic, record-grounded assistant for balances, spending, budgets, goals, recurring bills, transfer status, FX, and security questions — **no external LLM** |

### Business workspace (`/business`)

| Feature | What exists |
|---|---|
| Invoices | Create drafts, send, record payments, void; payment posting writes a balanced journal |
| Bills | Create bills linked to vendors, route through two-step approval, pay from treasury |
| Vendors | Organization vendor records used by bills and payouts |
| Approvals | Two-step maker-checker: approver, then finance manager; self-approval blocked; PIN and comment required |
| Expenses | Employee claims, policy flags against card limits, reimbursement from an organization account |
| Cards | Organization cards with server-enforced limits and categories |
| Team | Organization memberships and role updates |
| Reports | Treasury and spend reporting derived from ledger data |
| Developers | Create/revoke sandbox API keys, inspect webhook deliveries, copy API examples |

### Operations console (`/ops`)

| Feature | What exists |
|---|---|
| Overview | Attention queue, platform pulse, audit activity |
| Customers | Searchable directory and Customer 360 with balances, cases, risk, transactions |
| Support | Ticket queue with status and priority updates |
| Risk | Synthetic signals, audited review decisions with note and PIN |
| Compliance | Synthetic KYC/KYB/AML/dispute cases with evidence note and PIN |
| Reconciliation | Compare posted external payouts with synthetic provider events; explicit exception items; resolution notes |
| Ledger | Journal inspector, filters, posting detail, per-currency balance check, controlled adjustments, compensating reversals |
| Audit | Filterable immutable audit trail |
| Integrations | Provider events, processing payouts, simulated settlement, payout failure, webhook replay |
| Health | SQLite integrity check, ledger balance check, runtime information |
| Permissions | Executable platform and organization permission matrix |

### Developer API

- Read-only JSON API at `/api/v1`.
- Bearer keys prefixed `atlas_sk_sandbox_`.
- Keys are SHA-256 hashed at rest, owner-scoped, revocable, and rate-limited.
- Organization scope through `org_id`.
- Stable error envelope, request correlation ID, `Cache-Control: no-store`.

---

## Screenshots

> The repository does not ship screenshot assets yet. Add real captures to `docs/screenshots/` and replace the placeholders below. Do not use generated mockups that imply features the app does not have.

| Surface | Suggested capture | Placeholder |
|---|---|---|
| Marketing home | Hero + live ledger preview | `docs/screenshots/home.png` |
| Personal overview | Balance cards, cashflow chart, recent activity | `docs/screenshots/personal-overview.png` |
| FX studio | Quote preview with rate, fee, and PIN step | `docs/screenshots/fx-studio.png` |
| Transfer receipt | Posted transfer with journal trace | `docs/screenshots/transfer-receipt.png` |
| Business approvals | Two-step approval trail | `docs/screenshots/approvals.png` |
| Operations ledger | Journal detail with signed postings | `docs/screenshots/ledger.png` |
| Operations reconciliation | Run summary and exception items | `docs/screenshots/reconciliation.png` |
| Developer API | Key management and endpoint reference | `docs/screenshots/developers.png` |
| Mobile | Personal dashboard at 390 px width | `docs/screenshots/mobile.png` |

Suggested markdown once files exist:

```md
![ATLAS personal overview](docs/screenshots/personal-overview.png)
```

---

## Tech stack

| Layer | Technology | Used for |
|---|---|---|
| Framework | **Next.js 16.4.3** (App Router) | Routing, server components, server actions, route handlers, builds |
| UI runtime | **React 19.3.1** | Server and client components |
| Language | **TypeScript 5.9** (strict) | Application, tests, and scripts |
| Styling | **Tailwind CSS v4** + semantic CSS tokens | Design system, responsive layouts, light/dark themes |
| Components | **Radix UI** primitives, custom primitives, **Lucide** icons | Accessible dialogs, menus, selects, tabs, tooltips, tables |
| Charts | **Recharts** | Cashflow, category mix, and net charts |
| Feedback | **Sonner** | Toasts for actions and errors |
| Theming | **next-themes** | Light/dark/system theme |
| Forms | Native forms + React `useActionState` / `useFormStatus` | Progressive-enhancement server-action forms |
| Validation | **Zod 4** | API query validation and structured validation errors |
| Database | **SQLite** via **better-sqlite3 13** | Persistent local sandbox storage, WAL mode, foreign keys |
| Money | Integer minor units + **decimal.js** | Exact FX conversion with deterministic half-up rounding |
| Docs | **marked** | Renders `docs/*.md` inside the app |
| Auth | Custom **scrypt** + opaque hashed sessions | Password/PIN hashing, session cookies |
| Unit tests | **Vitest 5** | Domain, service, auth, and API tests |
| Browser tests | **Playwright 1.64** | Chromium workflows against a production build |
| Deployment | **Vercel** | Production sandbox deployment from `main` |

> [!NOTE]
> Some packages are installed for planned work but are not central to the current implementation. `@tanstack/react-query` is mounted as a provider but no client queries use it yet. `react-hook-form`, `drizzle-orm`, and `motion` are present in `package.json` but are not used by the current source. The documentation above lists what the code actually uses.

---

## Architecture

ATLAS is a **modular monolith**. The browser talks to Next.js; server components read data, server actions perform writes, and a single route handler exposes the read-only API. Financial writes pass through domain services and a double-entry ledger before touching SQLite.

```mermaid
flowchart LR
    B[Browser] -->|HTTPS| N[Next.js App Router]
    N --> RSC[Server Components]
    N --> SA[Server Actions]
    N --> API["/api/v1 route handler"]

    SA --> AUTH["Session + RBAC<br/>ownership + step-up PIN"]
    API --> KEY["Bearer key auth<br/>hash + rate limit"]

    AUTH --> SVC[Domain services]
    KEY --> SVC

    SVC --> LEDGER[Double-entry ledger]
    LEDGER --> DB[(SQLite WAL)]

    RSC --> DB
    N --> DOCS["docs/*.md via marked"]

    subgraph Workspaces
      P[Personal]
      BIZ[Business]
      OPS[Operations]
    end
    RSC --> P
    RSC --> BIZ
    RSC --> OPS
```

### Request flow for a money movement

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant N as Next.js server action
    participant A as Auth / RBAC
    participant S as Transfer service
    participant L as Ledger
    participant D as SQLite

    U->>N: Submit transfer form
    N->>A: Resolve session, verify PIN, check permission
    A->>S: Authorized request
    S->>D: BEGIN IMMEDIATE + claim idempotency key
    S->>S: Validate balance, holds, quote, currency
    S->>L: Build signed postings
    L->>D: Insert journal + postings
    D-->>S: Commit
    S-->>N: Transfer result
    N-->>U: Receipt page + revalidated data
```

### Architectural principles

1. **The UI never calculates a financial write.** It submits validated input to a server action.
2. **Permission and ownership are separate checks.** A role may allow an action; the resource must still belong to the caller.
3. **Money is integer minor units.** No floating-point arithmetic touches balances.
4. **Every posted journal balances per currency.** Debit positive, credit negative; the sum must be zero.
5. **Idempotency is claimed inside the same transaction as the money movement.** A retry cannot double-pay.
6. **Posted history is immutable.** Corrections are compensating journals, never edits.
7. **Platform staff cannot move customer funds.** Operations roles review; they do not inherit customer transfer authority.

More detail: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and [`docs/LEDGER.md`](docs/LEDGER.md).

---

## Project structure

```text
fintech-atlas/
├─ src/
│  ├─ app/
│  │  ├─ actions/            # 38 server actions (auth, transfers, business, ops, personal, developers, assistant)
│  │  ├─ api/v1/            # Read-only bearer API route handler
│  │  ├─ app/               # Personal workspace routes
│  │  ├─ business/          # Business workspace routes
│  │  ├─ ops/               # Operations console routes
│  │  ├─ docs/              # /docs and /docs/[slug] markdown renderer
│  │  ├─ login/             # Sign-in and demo personas
│  │  ├─ pricing/           # Public pricing page
│  │  ├─ security/          # Public security page
│  │  ├─ developers/        # Public developer overview
│  │  ├─ layout.tsx         # Fonts, theme, query provider, toaster
│  │  └─ globals.css        # Semantic design tokens and utilities
│  ├─ components/
│  │  ├─ app/               # App shell, nav, forms, charts, feature components
│  │  ├─ brand/             # Logo
│  │  ├─ docs/              # Markdown renderer
│  │  ├─ marketing/         # Marketing chrome
│  │  └─ ui/                # Buttons, badges, forms, tables, overlays, money, charts
│  ├─ db/
│  │  ├─ migrations/        # 001_init.sql, 002_ledger_guards.sql
│  │  ├─ client.ts          # Singleton database access
│  │  ├─ migrate.ts         # Migration runner and SQLite pragmas
│  │  ├─ seed.ts            # Deterministic demo dataset
│  │  └─ reset.ts           # Timestamped backup + rebuild
│  ├─ domain/
│  │  ├─ money.ts           # Minor units, currency exponents, formatting
│  │  ├─ fx.ts              # Decimal rates and half-up rounding
│  │  ├─ ledger.ts          # Journals, postings, holds, audit, transactions
│  │  ├─ rbac.ts            # Platform/business roles and permissions
│  │  ├─ access.ts          # Ownership and resource access
│  │  ├─ identity.ts        # Session and membership types
│  │  └─ errors.ts          # Domain error codes and HTTP mapping
│  ├─ lib/
│  │  ├─ auth.ts            # Sessions, login, PIN, org context, guards
│  │  ├─ password.ts        # scrypt hashing and token helpers
│  │  ├─ rate-limit.ts      # In-process fixed-window limiter
│  │  ├─ demo.ts            # Demo personas and credentials
│  │  ├─ docs.ts            # Documentation manifest and file loader
│  │  ├─ home.ts            # Safe return-path handling
│  │  └─ utils.ts           # Formatting, dates, IDs, helpers
│  └─ server/
│     ├─ finance.ts         # Accounts, transactions, budgets, goals, cards
│     ├─ transfers.ts       # Quotes, transfers, holds, beneficiaries
│     ├─ business.ts        # Invoices, bills, vendors, expenses, approvals
│     ├─ ops.ts             # Operations queries and decisions
│     ├─ personal.ts        # Notifications, profile, support
│     ├─ assistant.ts       # Deterministic Atlas Assistant
│     └─ api.ts             # Bearer key authentication
├─ docs/                    # Product, engineering, evidence, and portfolio documents
├─ e2e/                     # Playwright browser tests
├─ scripts/                 # Route, action, and component audit scripts
├─ data/                    # Local SQLite database (gitignored)
├─ next.config.ts           # External packages, tracing, headers, package imports
├─ playwright.config.ts     # Isolated temp database, production server on port 3218
├─ vitest.config.ts         # Unit test configuration
├─ postcss.config.mjs       # Tailwind v4 PostCSS plugin
├─ eslint.config.mjs        # Next.js ESLint configuration
└─ package.json             # Scripts, dependencies, Node engine
```

---

## Getting started

### Prerequisites

- **Node.js 22.11+** (the package declares `>=22.11`)
- **npm** (the repository includes `package-lock.json`)
- No Docker, PostgreSQL, or external service is required.

### 1. Clone

```bash
git clone https://github.com/limon-l/fintech-atlas.git
cd fintech-atlas
```

### 2. Install dependencies

```bash
npm ci
```

If you are updating dependencies intentionally, use `npm install` instead.

### 3. Configure the environment

```bash
cp .env.example .env.local
```

PowerShell:

```powershell
Copy-Item .env.example .env.local
```

The default values work locally. No secret keys are required for the demo.

### 4. Prepare the database

No manual step is required. On the first database access, ATLAS:

1. Creates `data/atlas.db` if it does not exist.
2. Applies every SQL migration in `src/db/migrations/`.
3. Seeds the deterministic demo dataset **only when the `users` table is empty**.

Optional explicit commands:

```bash
npm run db:migrate
npm run db:seed
```

To rebuild from scratch while keeping a timestamped backup:

```bash
npm run db:reset
```

### 5. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 6. Build and run production locally

```bash
npm run build
npm start
```

The production server uses the same database path unless `DATABASE_PATH` is set.

### 7. Verify the build

```bash
npm run typecheck
npm test
npm run lint
npm run build
npm run test:e2e
```

Playwright requires Chromium:

```bash
npx playwright install chromium
```

> [!TIP]
> On restricted PowerShell systems, use `npm.cmd` if `npm` is blocked by the execution policy. The build uses `next/font`, which fetches Google Fonts at build time and therefore needs network access.

---

## Demo accounts

Every seeded account uses the password **`atlas-demo-2026`**. Sensitive actions use the PIN **`246810`**.

| Persona | Email | Role | Workspace |
|---|---|---|---|
| Maya Chen | `maya@atlas.demo` | Personal customer | `/app` |
| Jonas Reed | `jonas@atlas.demo` | Business owner | `/business` |
| Priya Nair | `priya@atlas.demo` | Finance manager | `/business` |
| Leo Fischer | `leo@atlas.demo` | Approver | `/business/approvals` |
| Sam Okafor | `sam@atlas.demo` | Employee | `/business/expenses` |
| Nadia Haddad | `nadia@atlas.demo` | Risk analyst | `/ops/risk` |
| Owen Blake | `owen@atlas.demo` | Support agent | `/ops/support` |
| Elena Voss | `elena@atlas.demo` | Compliance officer | `/ops/compliance` |
| Atlas Operator | `admin@atlas.demo` | Super admin | `/ops` |

The login page also exposes one-click persona buttons so reviewers can move between surfaces without typing credentials.

### Seeded records worth opening

| Record | ID / route |
|---|---|
| Maya's USD wallet | `acc_maya_usd` |
| Maya's EUR wallet | `acc_maya_eur` |
| Pending GBP payout | `trf_maya_gbp_pending` |
| Business payout with reconciliation difference | `trf_biz_payout` |
| Two-step approval | `apr_1` |
| Reconciliation run | `rec_run_1` |
| Maya's card | `crd_maya_1` |
| Kyoto goal | `gol_kyoto` |
| Current budget | `bdg_maya_current` |
| Seeded API key (Jonas) | `atlas_sk_sandbox_demo_7f3c9a2e5b814d06` |

> [!WARNING]
> The seeded API key is intentionally public demo data. Never reuse this pattern for a real key. In a real deployment, keys must be generated per user, stored hashed, scoped, rotated, and revoked.

---

## Environment variables

ATLAS reads three environment variables. All have safe local defaults.

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `DATABASE_PATH` | No | `./data/atlas.db` | SQLite file location. Relative paths resolve from the project root. On Vercel, the runtime falls back to `/tmp/atlas.db` when unset. |
| `NEXT_PUBLIC_APP_URL` | No | `http://localhost:3000` | Public base URL used in receipts, developer examples, and links. |
| `ATLAS_MODE` | No | `sandbox` | Documents the intended mode. The application is sandbox-only; do not set this to imply live-money operation. |

Example `.env.local`:

```dotenv
DATABASE_PATH=./data/atlas.db
NEXT_PUBLIC_APP_URL=http://localhost:3000
ATLAS_MODE=sandbox
```

> [!NOTE]
> No database password, OAuth secret, payment-provider key, or SMTP credential is required because none of those integrations exist in this repository. The `VERCEL` variable is provided automatically by Vercel and is used only to choose the writable `/tmp` database path.

---

## Available scripts

| Script | Command | What it does |
|---|---|---|
| `dev` | `next dev` | Start the development server with hot reload. |
| `build` | `next build` | Create an optimized production build. |
| `start` | `next start` | Serve the production build. |
| `lint` | `eslint .` | Run ESLint across the repository. |
| `typecheck` | `tsc --noEmit` | Type-check without emitting files. |
| `db:migrate` | `tsx src/db/migrate.ts` | Apply pending SQL migrations. |
| `db:seed` | `tsx src/db/seed.ts` | Seed the deterministic demo dataset when empty. |
| `db:reset` | `tsx src/db/reset.ts` | Back up the current database, then delete and rebuild it. |
| `test` | `vitest run` | Run the unit/integration suite once. |
| `test:watch` | `vitest` | Run Vitest in watch mode. |
| `test:e2e` | `playwright test` | Run Chromium browser tests against a production build and isolated temp database. |
| `verify` | `npm run typecheck && npm run test && npm run build` | Run the core local verification chain. |

Additional audit scripts:

```bash
node scripts/audit-routes.mjs       # 86 route and internal-link checks
node scripts/audit-actions.mjs      # 38 server-action wiring checks
node scripts/audit-components.mjs   # 37 component-usage checks
```

The route audit expects a running production server. Set `AUDIT_BASE` to point at a different origin:

```bash
AUDIT_BASE=http://localhost:3211 node scripts/audit-routes.mjs
```

PowerShell:

```powershell
$env:AUDIT_BASE="http://localhost:3211"; node scripts/audit-routes.mjs
```

---

## API reference

### Base URL

| Environment | Base URL |
|---|---|
| Production | `https://fintech-atlas-omega.vercel.app/api/v1` |
| Local | `http://localhost:3000/api/v1` |

### Authentication

Create a key at **Business → Developers** (`/business/developers`) or use the seeded Jonas key for local exploration.

```http
Authorization: Bearer atlas_sk_sandbox_...
```

Keys are environment-scoped to `sandbox`, stored as SHA-256 hashes, and checked against the owning user's current role and status on every request. Revocation takes effect immediately. The API is rate-limited to **120 requests per minute per key**.

### Endpoints

| Method | Endpoint | Permission | Notes |
|---|---|---|---|
| `GET` | `/accounts` | Owner or `account:read` in the organization | Derived ledger balance, held amount, available amount |
| `GET` | `/transactions` | Owner or `account:read` in the organization | Supports `account_id`, `limit`, `offset` |
| `GET` | `/transfers` | Authenticated key owner | Personal scope only; supports `limit` |
| `GET` | `/ledger/journals` | Platform `ops:ledger` | Journals with posting counts and per-currency balance checks |
| `GET` | `/health` | Platform `ops:read` | SQLite integrity, ledger balance, counts, runtime |

### Query parameters

| Parameter | Applies to | Rules |
|---|---|---|
| `limit` | accounts, transactions, transfers, journals | Integer `1–100`; default `25`; invalid values return `422` |
| `offset` | accounts, transactions | Integer `0–100000`; default `0` |
| `org_id` | accounts, transactions | Requires active membership and `account:read` |
| `account_id` | transactions | Filters to one account owned by the resolved scope |
| `kind` | journals (service-level filter) | Journal kind filter used by the operations UI |

### Example: organization accounts

```bash
curl -s "https://fintech-atlas-omega.vercel.app/api/v1/accounts?org_id=org_northwind" \
  -H "Authorization: Bearer atlas_sk_sandbox_demo_7f3c9a2e5b814d06"
```

```json
{
  "data": [
    {
      "id": "acc_northwind_usd",
      "name": "Operating account",
      "currency": "USD",
      "status": "active",
      "balance_minor": 11271000,
      "held_minor": 0,
      "available_minor": 11271000
    },
    {
      "id": "acc_northwind_tax",
      "name": "Tax reserve",
      "currency": "USD",
      "status": "active",
      "balance_minor": 1800000,
      "held_minor": 0,
      "available_minor": 1800000
    },
    {
      "id": "acc_northwind_eur",
      "name": "EUR treasury",
      "currency": "EUR",
      "status": "active",
      "balance_minor": 1250000,
      "held_minor": 0,
      "available_minor": 1250000
    }
  ],
  "meta": {
    "environment": "sandbox",
    "request_id": "b3046854-284c-40b7-9bcc-a7c3d55a0e8d",
    "limit": 25,
    "offset": 0,
    "total": 3
  }
}
```

### Example: recent transactions

> The transaction IDs, relative dates, and ordering below are illustrative. A fresh seed generates new IDs and relative timestamps; the response shape and field names are stable.

```bash
curl -s "http://localhost:3000/api/v1/transactions?account_id=acc_maya_usd&limit=2" \
  -H "Authorization: Bearer YOUR_SANDBOX_KEY"
```

```json
{
  "data": [
    {
      "id": "txn_26c651f600a64b0c914f",
      "accountId": "acc_maya_usd",
      "accountName": "Everyday USD",
      "accountCurrency": "USD",
      "direction": "debit",
      "amountMinor": 8420,
      "currency": "USD",
      "status": "posted",
      "category": "Groceries",
      "merchant": "Whole Foods",
      "description": "Weekly shop",
      "counterparty": null,
      "occurredAt": "2026-10-30T14:24:00.000Z",
      "transferId": null,
      "journalId": "jrn_b9a5054f79764bec996b",
      "cardLast4": "4821"
    },
    {
      "id": "txn_1bfc3352812d46f58e75",
      "accountId": "acc_maya_usd",
      "accountName": "Everyday USD",
      "accountCurrency": "USD",
      "direction": "debit",
      "amountMinor": 6840,
      "currency": "USD",
      "status": "posted",
      "category": "Dining",
      "merchant": "Dishoom",
      "description": "Dinner with friends",
      "counterparty": null,
      "occurredAt": "2026-10-29T10:51:00.000Z",
      "transferId": null,
      "journalId": "jrn_62a02ed1dc054bf6a0a4",
      "cardLast4": "4821"
    }
  ],
  "meta": {
    "environment": "sandbox",
    "request_id": "...",
    "limit": 2,
    "offset": 0,
    "total": 85
  }
}
```

### Example: staff ledger access

```bash
curl -s "http://localhost:3000/api/v1/ledger/journals?limit=5" \
  -H "Authorization: Bearer STAFF_SANDBOX_KEY"
```

### Error envelope

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Ledger permission required"
  },
  "meta": {
    "environment": "sandbox",
    "request_id": "..."
  }
}
```

| HTTP status | Domain code | Meaning |
|---|---|---|
| `401` | `UNAUTHENTICATED` | Missing, invalid, or revoked bearer key |
| `403` | `FORBIDDEN` | Key owner lacks the required permission |
| `404` | `NOT_FOUND` | Unknown endpoint |
| `422` | `VALIDATION_ERROR` | Invalid query or request payload |
| `429` | `RATE_LIMITED` | More than 120 requests per minute for the key |
| `500` | `INTERNAL` | Unexpected server failure |

### What the API does not do

- No write endpoints. Transfer submission is a server-action UI workflow.
- No webhook delivery to external endpoints. The webhook table is a local queue and replay is simulated.
- No OAuth, API-key rotation endpoint, or multi-key scoping UI.
- No organization transfers. `org_id` applies to account and transaction reads only.

---

## Database

### Technology

| Aspect | Choice |
|---|---|
| Engine | SQLite 3 |
| Driver | `better-sqlite3` 13 (synchronous, native) |
| ORM | **None** — direct parameterized SQL |
| Migrations | Versioned `.sql` files applied on first access |
| Journal mode | WAL |
| Safeguards | Foreign keys on, `busy_timeout = 8000`, `synchronous = NORMAL` |
| Local path | `./data/atlas.db` |
| Vercel path | `/tmp/atlas.db` (ephemeral, per-instance) |

### Schema overview

| Group | Tables |
|---|---|
| Identity | `users`, `sessions`, `organizations`, `memberships`, `api_keys` |
| Banking | `accounts`, `beneficiaries`, `cards`, `transfers`, `holds`, `fx_quotes`, `idempotency_keys` |
| Ledger | `ledger_accounts`, `journal_entries`, `postings` |
| Personal finance | `transactions`, `budgets`, `budget_categories`, `goals`, `goal_contributions` |
| Business finance | `invoices`, `invoice_lines`, `bills`, `vendors`, `expenses`, `approval_requests`, `approval_steps` |
| Operations | `customers`, `support_tickets`, `risk_events`, `compliance_cases`, `reconciliation_runs`, `reconciliation_items` |
| Platform | `audit_events`, `notifications`, `provider_events`, `webhook_events`, `spending_policies`, `schema_migrations` |

### Relationships at a glance

- A **user** has many **accounts**, **sessions**, **cards**, **goals**, **notifications**, and **API keys**.
- An **organization** has many **memberships**, **accounts**, **invoices**, **bills**, **vendors**, **expenses**, **cards**, and **approval requests**.
- An **account** maps to one **ledger account**.
- A **journal entry** has many **postings**; every posting belongs to a journal and a ledger account.
- A **transfer** may reference a **journal entry**, a **beneficiary**, a **quote**, and a **hold**.
- An **approval request** has ordered **approval steps**; each step records the required role and the decision.
- **Audit events** are append-only and reference the actor and resource.

### Money representation

- All amounts are **integer minor units** (`amount_minor`).
- Currency exponents are explicit, including zero-decimal and three-decimal currencies.
- FX rates are **decimal strings** and calculations use `decimal.js` with deterministic half-up rounding to the target currency.
- Customer liability balances are derived as `-SUM(postings)` for the customer's ledger account.
- Available funds = ledger balance − active holds.

### Database guards

The second migration adds triggers that:

- reject edits or deletes of **postings**;
- reject edits of **posted journal entries**;
- reject direct insertion of **final journals**;
- reject finalization of an **unbalanced journal**;
- reject edits or deletes of **audit events**.

### Migrations and seed behavior

- `src/db/migrations/001_init.sql` creates the schema.
- `src/db/migrations/002_ledger_guards.sql` adds immutability and balance triggers.
- `src/db/seed.ts` is deterministic and only runs when `users` is empty.
- `src/db/reset.ts` writes a timestamped backup before rebuilding.
- `next.config.ts` traces migration SQL into serverless bundles so the runtime can find it on Vercel.

---

## Authentication & authorization

### Login

- Email/password sign-in at `/login`.
- Passwords and PINs are hashed with **scrypt** (`N=16384`, `r=8`, `p=1`) using a per-secret random salt.
- Comparison uses `timingSafeEqual`.
- Login is rate-limited by IP (20 attempts / 10 minutes) and by normalized email (8 attempts / 10 minutes).
- There is **no self-service registration**. The sandbox is seeded with demo identities.
- There is **no JWT, OAuth, SAML, magic link, MFA, or passkey flow**.

### Sessions

- Opaque random session tokens.
- Only the **SHA-256 hash** of the token is stored in `sessions`.
- Cookie name: `atlas_session`.
- Cookie flags: `HttpOnly`, `SameSite=Lax`, `Secure` in production.
- Session lifetime: **8 hours**.
- Sign-out revokes the current session and clears the organization cookie.
- Organization selection is stored in `atlas_org` and validated against the user's memberships.

### Roles and permissions

**Platform roles**

| Role | Scope |
|---|---|
| `customer` | Personal workspace only; no operations permissions |
| `support` | `ops:read`, `audit:read` |
| `risk` | `ops:read`, `ops:risk`, `audit:read`, `report:read` |
| `compliance` | `ops:read`, `ops:compliance`, `audit:read`, `report:read` |
| `admin` | `ops:read`, `ops:reconcile`, `ops:ledger`, `ops:admin`, `audit:read`, `dev:manage` |
| `super_admin` | All platform operations permissions |

**Organization roles**

| Role | Typical capabilities |
|---|---|
| `owner` | Full organization treasury, approvals, team, developers, reports |
| `finance_manager` | Transfers, invoices, bills, payments, approvals, reports |
| `approver` | Read treasury, decide approvals, submit expenses |
| `employee` | Read accounts/invoices, submit expenses, view cards |

Permissions are explicit strings in `src/domain/rbac.ts`. Resource ownership is checked separately from permission. Platform staff are **never** granted implicit customer fund-movement authority.

### Maker-checker

Approvals use two ordered steps:

1. **Approver**
2. **Finance manager**

Rules enforced on the server:

- The requester cannot decide their own request, even if their role matches the current step.
- The current step role is read from the database on every decision.
- A decision requires a comment and a valid step-up PIN.
- Every decision writes an audit event and a webhook queue row.

### Step-up PIN

Sensitive actions require the six-digit demo PIN (`246810`). PIN verification is rate-limited to **5 attempts per 5 minutes per user**. The PIN is a demonstration of step-up authorization, **not** a second authentication factor.

### API keys

- Format: `atlas_sk_sandbox_<random>`.
- Stored as SHA-256 hashes with a visible prefix.
- Revocable from the business developer page.
- Read-only and rate-limited.
- Scoped to the owning user's current permissions and status.

More detail: [`docs/RBAC.md`](docs/RBAC.md).

---

## Ledger & money model

### Sign convention

- **Debit positive**, **credit negative**.
- Every posted journal must sum to **zero per currency**.
- Customer balances are liabilities, so the customer-facing balance is `-SUM(postings)`.

### Journal lifecycle

1. A service builds a journal and its postings.
2. The journal is written inside an immediate SQLite transaction.
3. A database trigger rejects finalization if any currency does not net to zero.
4. Posted journals and postings become immutable.
5. Corrections use compensating journals, never edits.

### Holds and available funds

External payouts create an active **hold** and a `processing` transfer. The ledger balance does not change until settlement. Settlement captures the hold and posts the payout journal. Failure releases the hold without changing the ledger balance.

### Internal transfer

- Debits the source wallet.
- Credits the destination wallet.
- Posts one balanced journal.
- Completes immediately.

### External payout

- Creates a hold for the amount plus fee.
- Creates a `processing` transfer.
- Waits for simulated provider settlement or failure.
- Settlement posts the payout journal and captures the hold.

### FX conversion

- Requires a persisted, unexpired quote.
- Converts between the customer's own Atlas wallets only.
- External FX payouts are rejected.
- Posts source, target, and fee legs, each balanced per currency.
- Uses deterministic synthetic rates with an explicit fee.

### Idempotency

- Every transfer request includes an idempotency key (minimum 8 characters) and a request hash.
- The key is claimed inside the same transaction as the money movement.
- A replay with the same key and hash returns the stored result.
- A changed payload with the same key conflicts.
- This prevents double-payment on retries.

### Reversals and adjustments

- Reversals create a new compensating journal linked to the original.
- Controlled adjustments post a new journal; they never edit history.
- Reconciliation differences become explicit exception items and are never silently written off.

More detail: [`docs/LEDGER.md`](docs/LEDGER.md).

---

## Testing & verification

### Test suites

| Suite | Command | Count | What it covers |
|---|---|---|---|
| Unit / integration | `npm test` | **57 tests in 6 files** | Money precision, journal balance, idempotency, holds, settlement, FX, reversals, DB guards, API auth, operations permissions, approvals, RBAC |
| Browser E2E | `npm run test:e2e` | **10 Chromium tests** | Login/logout, session revocation, workspace routes, ownership, card controls, personal transfer, FX conversion, maker-checker approval, developer keys, payout failure/settlement, reconciliation, risk, support, webhook replay |
| Route audit | `node scripts/audit-routes.mjs` | **86/86 checks** | Public pages, docs, protected routes, API contracts, internal links |
| Action audit | `node scripts/audit-actions.mjs` | **38/38 checks** | Every exported server action is referenced by UI or tests |
| Component audit | `node scripts/audit-components.mjs` | **37/37 checks** | Every component file is imported somewhere |

### Verification snapshot — 2026-11-03

| Check | Result |
|---|---|
| `npm run typecheck` | **PASS** — no TypeScript errors |
| `npm test` | **PASS** — 57/57 |
| `npm run lint` | **PASS** — 0 errors, 0 warnings |
| `npm run build` | **PASS** — optimized production build |
| `npm run test:e2e` | **PASS** — 10/10 |
| `node scripts/audit-routes.mjs` | **PASS** — 86/86 |
| `node scripts/audit-actions.mjs` | **PASS** — 38/38 |
| `node scripts/audit-components.mjs` | **PASS** — 37/37 |
| Deployed `/api/v1/accounts?org_id=org_northwind` | **PASS** — `200` with seeded data |

### Run everything

```bash
npm run typecheck
npm test
npm run lint
npm run build

npx playwright install chromium
npm run test:e2e

npm start -- --port 3211
# in another terminal:
node scripts/audit-routes.mjs
node scripts/audit-actions.mjs
node scripts/audit-components.mjs
```

### What is not tested

- Accessibility (axe, Lighthouse, screen-reader passes).
- Visual regression and cross-browser rendering.
- Core Web Vitals and load performance.
- Multiprocess concurrency against SQLite.
- Independent security review or penetration testing.
- Every form, persona, and viewport combination.
- Live provider behavior (none exists).

See [`docs/RELEASE.md`](docs/RELEASE.md) for the full quality matrix and [`docs/BACKLOG.md`](docs/BACKLOG.md) for remaining work.

---

## Deployment

### Vercel (current production)

1. Push the repository to GitHub.
2. Import the repository into Vercel.
3. Keep the framework preset as **Next.js**.
4. No environment variables are required for the sandbox. Optionally set `NEXT_PUBLIC_APP_URL` to the deployment URL.
5. Deploy.

The repository includes a Vercel-specific runtime safeguard:

- `next.config.ts` sets `serverExternalPackages: ["better-sqlite3"]`.
- `outputFileTracingIncludes` bundles `src/db/migrations/**/*.sql` into serverless traces.
- `src/db/migrate.ts` falls back to `/tmp/atlas.db` when `process.env.VERCEL` is set.

> [!CAUTION]
> The Vercel deployment is a **demo**, not durable storage. `/tmp` is per-instance and ephemeral. Do not use it for data you expect to keep. For durable hosting, point `DATABASE_PATH` at a persistent volume or migrate to PostgreSQL.

### Self-hosted Node.js

```bash
git clone https://github.com/limon-l/fintech-atlas.git
cd fintech-atlas
npm ci
npm run build
DATABASE_PATH=/var/lib/atlas/atlas.db npm start
```

Requirements:

- Node.js 22.11+
- A writable directory for the SQLite file (or `:memory:` for ephemeral tests)
- A reverse proxy with TLS if exposed to a network
- A process manager or container restart policy

Because SQLite uses a single writer, run **one application instance** against one database file. Multiple instances require PostgreSQL or a shared database layer.

### Docker

No `Dockerfile` or `docker-compose.yml` is included in this repository. A container deployment would need to add one and mount a persistent volume for `DATABASE_PATH`. The SQLite file must not live only inside the container filesystem.

### CI/CD

No GitHub Actions workflow is included. The current deployment path is Vercel's Git integration on `main`. A production pipeline should add:

- `npm ci`
- `npm run typecheck`
- `npm test`
- `npm run lint`
- `npm run build`
- `npm run test:e2e`

### Database migration path to PostgreSQL

The domain and service layers avoid SQLite-specific query syntax beyond migrations and a few pragmas. A production migration would need to:

1. Move the schema to PostgreSQL with explicit `NUMERIC`/`BIGINT` money types.
2. Replace immediate SQLite transactions with `SERIALIZABLE` or row-level locking.
3. Move sessions and rate limiting to shared storage.
4. Add a durable outbox and worker for webhooks/provider events.
5. Add provider adapters behind signed, idempotent interfaces.
6. Add observability, backups, restore drills, and deployment controls.

None of these are implemented. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## Performance

Implemented optimizations:

- **Static prerendering** for the marketing pages, pricing, security, developers, docs index, and all nine documentation pages.
- **React Server Components** keep data fetching and most rendering on the server, reducing client JavaScript.
- **Server Actions** avoid hand-written API clients for every form.
- **`optimizePackageImports`** for `lucide-react`, `recharts`, and `date-fns`.
- **`next/font`** self-hosts Manrope and IBM Plex Mono with `display: swap`.
- **SQLite WAL mode**, foreign keys, and a busy timeout for local concurrency behavior.
- **`Cache-Control: no-store`** on the read-only API to prevent stale financial data.
- **Automatic code splitting** from the Next.js App Router.
- **No image payloads** in the current UI; there are no raster assets to optimize.

Not implemented or measured:

- Core Web Vitals, Lighthouse scores, bundle-size budgets.
- Redis or CDN caching for API responses.
- Database query timing and slow-query logging.
- Streaming/Suspense-based partial rendering.
- Image optimization (`next/image`) because the app currently uses no images.

---

## Security

### Implemented controls

| Control | Implementation |
|---|---|
| Password hashing | scrypt with per-secret salt and timing-safe comparison |
| Session storage | Opaque token; only SHA-256 hash stored; `HttpOnly`, `SameSite=Lax`, `Secure` in production |
| Session lifetime | 8 hours; sign-out revokes the current token |
| Authorization | Explicit platform and organization permissions checked on the server |
| Ownership | Account, transfer, invoice, bill, expense, and approval queries scoped to the caller |
| Maker-checker | Requester cannot approve their own request; role checked at each step |
| Step-up authorization | Hashed PIN with per-user rate limiting on sensitive actions |
| Login throttling | Per-IP and per-email fixed-window limits |
| API auth | Bearer key, SHA-256 hash at rest, revocation, 120 req/min/key |
| Input validation | Zod for API query validation; server-side parsing for form actions |
| Idempotency | Atomic key claim with request hash to prevent double-pay |
| Ledger guards | Database triggers reject edits/deletes and unbalanced finalization |
| Audit trail | Append-only events for logins, transfers, approvals, decisions, and corrections |
| Security headers | `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` |
| Secret handling | No live provider secrets are present; demo credentials are intentionally public |
| Platform separation | Operations staff cannot move customer funds through customer accounts |

### Known security gaps

- **No Content-Security-Policy.** Only the headers listed above are configured.
- **No CSRF token.** Writes use Next.js Server Actions with `SameSite=Lax` cookies; a dedicated CSRF token is not implemented.
- **Process-local rate limiting.** Limits do not hold across multiple instances.
- **No MFA/passkeys.** The PIN is a step-up demo, not a second factor.
- **No independent security review or penetration test.**
- **No field-level redaction** for broad synthetic staff customer visibility.
- **No managed secret store** or key rotation workflow.
- **No production backup, restore drill, or observability pipeline.**

> [!WARNING]
> Do not deploy this project with real customer data, real credentials, or real money. Treat every balance and identity as synthetic.

---

## Contributing

Contributions that improve correctness, accessibility, documentation, or test coverage are welcome.

### Workflow

1. Fork the repository.
2. Create a focused branch:

   ```bash
   git checkout -b feat/your-change
   ```

3. Install dependencies:

   ```bash
   npm ci
   ```

4. Make the change. Keep financial logic in `src/domain` or `src/server`, not in components.
5. Add or update tests.
6. Run the verification chain:

   ```bash
   npm run typecheck
   npm test
   npm run lint
   npm run build
   npm run test:e2e
   ```

7. Commit with a clear message.
8. Open a pull request describing the problem, the change, and the evidence.

### Guidelines

- **Do not invent financial behavior.** If a feature is simulated, say so in the UI and docs.
- **Do not bypass the ledger.** Every balance-changing action must post a balanced journal.
- **Do not weaken authorization.** Permission and ownership checks belong on the server.
- **Do not commit** `data/*.db`, `.env*` secrets, `test-results/`, `playwright-report/`, or `.next/`.
- **Keep the sandbox honest.** Never describe the project as production-ready, compliant, or safe for real money.
- **Match the existing style.** Strict TypeScript, semantic tokens, small components, server actions for writes.
- **Prefer tests over claims.** If you add a workflow, add evidence.

### Reporting issues

Include:

- What you expected.
- What happened.
- Steps to reproduce.
- The persona and route used.
- Relevant logs or screenshots.
- Whether the issue is financial, authorization, UI, or documentation related.

---

## Roadmap

### Completed

- [x] Double-entry ledger with signed postings, per-currency balancing, and database guards.
- [x] Integer minor-unit money and decimal FX with deterministic rounding.
- [x] Atomic idempotency, holds, settlement, reversals, and reconciliation.
- [x] Server-enforced platform and organization RBAC with ownership scoping.
- [x] Maker-checker approvals with PIN and comment requirements.
- [x] Personal, business, and operations workspaces with dedicated routes.
- [x] Read-only bearer API with hashed, revocable keys.
- [x] Rendered documentation at `/docs`.
- [x] Unit, integration, and Chromium E2E coverage for the main workflows.
- [x] Route, server-action, and component audit scripts.
- [x] Vercel deployment of the sandbox and read-only API.

### Planned — P0 (production safety)

- [ ] PostgreSQL migration with isolation and row-locking tests.
- [ ] Distributed rate limiting and shared session storage.
- [ ] MFA/passkeys and a real session-management UI.
- [ ] Provider adapters for payments, cards, and FX.
- [ ] Durable outbox and worker for webhooks/provider events.
- [ ] Webhook signature verification.
- [ ] Scheduled backups and restore drills.
- [ ] Observability: structured logs, traces, metrics, alerts.
- [ ] Reviewed Content-Security-Policy.
- [ ] Independent security review.

### Planned — P1 (verification and quality)

- [ ] Accessibility audit (axe/Lighthouse/screen reader).
- [ ] Visual regression baselines for light/dark and mobile.
- [ ] Core Web Vitals and bundle-size budgets.
- [ ] Multiprocess concurrency test.
- [ ] Full RBAC page/action matrix exercise.
- [ ] Transfer cancellation.
- [ ] Reconciliation offset-case tests.
- [ ] Approval delegation and re-submission.
- [ ] Audit export (CSV/JSON).
- [ ] CI workflow for all checks.

### Planned — P2 (product depth)

- [ ] Statement import and matching.
- [ ] Real card issuing and controls.
- [ ] Wealth and lending simulations.
- [ ] Multi-entity consolidation.
- [ ] Notification channel preferences.
- [ ] Internationalization.
- [ ] Storybook or interactive component catalog.

See [`docs/BACKLOG.md`](docs/BACKLOG.md) for the maintained list.

---

## License

Released under the **MIT License**. See [`LICENSE`](LICENSE).

```text
MIT License

Copyright (c) 2026 Limon Roy Apu

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## Author

**Limon Roy Apu**

| Platform | Link |
|---|---|
| GitHub | [@limon-l](https://github.com/limon-l) |
| Portfolio | [my-profile-green-beta.vercel.app](https://my-profile-green-beta.vercel.app/) |
| LinkedIn | [linkedin.com/in/limonroyapu](https://www.linkedin.com/in/limonroyapu/) |
| Email | [limonroyapu.edu@gmail.com](mailto:limonroyapu.edu@gmail.com) |

If this project helped you understand double-entry ledgers, server-enforced RBAC, or maker-checker workflows, consider starring the repository or connecting on LinkedIn.

---

## Acknowledgements

ATLAS is built on the work of the open-source community:

- [Next.js](https://nextjs.org/) — App Router, server components, server actions, route handlers.
- [React](https://react.dev/) — UI runtime.
- [TypeScript](https://www.typescriptlang.org/) — type safety.
- [Tailwind CSS](https://tailwindcss.com/) — styling and design tokens.
- [Radix UI](https://www.radix-ui.com/) — accessible primitives.
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) — synchronous SQLite driver.
- [decimal.js](https://mikemcl.github.io/decimal.js/) — exact decimal FX arithmetic.
- [Zod](https://zod.dev/) — validation.
- [Recharts](https://recharts.org/) — charts.
- [Lucide](https://lucide.dev/) — icons.
- [Sonner](https://sonner.emilkowal.ski/) — toasts.
- [next-themes](https://github.com/pacocoursey/next-themes) — theme switching.
- [marked](https://marked.js.org/) — Markdown rendering for the docs.
- [Vitest](https://vitest.dev/) — unit and integration tests.
- [Playwright](https://playwright.dev/) — browser tests.
- [Vercel](https://vercel.com/) — deployment platform.

And to the maintainers of every dependency in `package-lock.json` whose work makes projects like this possible.

---

<p align="center">
  <strong>ATLAS</strong> — synthetic money, real invariants.
</p>
