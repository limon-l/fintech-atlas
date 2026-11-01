# Portfolio and demonstration guide

## Case study

Financial interfaces are easy to make attractive and hard to make trustworthy. The interesting problems appear when a request is retried, a payout stays pending, two colleagues need different permissions, and an operator must correct a mistake without editing history.

ATLAS is a local fintech sandbox that takes those problems seriously. It combines a multi-currency personal workspace, an organization finance workspace with maker-checker approvals, and an operations console around one double-entry ledger. Every screen is backed by real SQLite persistence and server-enforced authorization.

## What the project demonstrates

- **Financial modeling:** integer minor units, decimal FX rates, per-currency balanced journals, holds, settlement and compensating reversals.
- **Safety:** atomic idempotency claims, database triggers that protect posted records, and server-side ownership checks.
- **Authorization:** explicit platform and organization permissions, step-up PINs and maker-checker approvals that reject self-approval.
- **Product surface:** personal, business and operations workspaces with dedicated routes rather than placeholder views.
- **Developer experience:** a hashed-key read API with revocation, structured errors and rendered documentation at `/docs`.
- **Honest reporting:** a QA report and backlog that separate tested behavior from roadmap work.

## Demonstration path

1. Open `/login` and enter as Maya. Compare ledger, held and available balances per currency.
2. Submit a small own-account USD transfer using the sandbox PIN; inspect its persistent receipt and journal.
3. Initiate an external payment. Observe the processing state and reserved funds before settlement.
4. Request an FX quote and inspect the rate, fee, expiry and recipient amount.
5. Switch to Jonas, Priya and Leo to compare organization roles and approval steps.
6. Create a bearer key at `/business/developers`, query the read API, revoke it, then verify rejection.
7. Enter as operations staff. Record a risk or compliance decision with notes, then inspect the audit trail.
8. Run authorized reconciliation, settle a processing payout, and inspect the resulting journal.
9. Open `/docs` to read the architecture, ledger, RBAC and release evidence.

## Resume description

Built a full-stack fintech sandbox in Next.js and TypeScript with a double-entry SQLite ledger, atomic idempotent transfers, decimal FX conversion, holds and compensating reversals, server-enforced RBAC, maker-checker approvals, an operations console, a revocable read API and a tested release backlog.

## Engineering discussion points

- Ledger posting signs versus customer-facing normal balances.
- Deterministic rounding across currency exponents (JPY=0, KWD=3).
- Atomic idempotency claims and money movement in one transaction.
- Holds during asynchronous processing and capture on settlement.
- Reversals through compensating journals, never edited history.
- Staff permission versus account ownership.
- SQLite writer serialization versus PostgreSQL row locking.
- Database invariants versus domain and API validation.
- Internal event replay versus verified external delivery.
- Maker-checker and self-approval prevention.

## Scope and non-claims

No browser screenshots, accessibility scores, Lighthouse results or Core Web Vitals were collected. There is no independent security review, live payment provider, real KYC, usable card issuing or production deployment. ATLAS is a synthetic portfolio project. Do not attach invented performance, compliance or security claims to this case study.
