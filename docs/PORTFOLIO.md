# Portfolio and demonstration guide

## Case study

Financial UI needs reliable behavior when requests repeat, payouts remain pending, and organization members have different permissions. ATLAS connects a themed financial workspace to persistent sandbox services and an auditable ledger.

Retain the modular monolith and SQLite for a single local simulation, keeping money movement inside one transaction. PostgreSQL and durable workers are future migration work. The current batch repairs compilation, closes database immutability gaps, adds regression tests, connects staff operations, and implements the advertised read API.

## Demonstration

1. Enter as Maya. Compare ledger, held and available balances per currency.
2. Submit a small own-account USD transfer using the sandbox PIN; inspect its persistent receipt.
3. Initiate an external payment. Observe processing and reserved funds before simulated settlement.
4. Inspect a synthetic FX quote's rate, fee, expiry and recipient amount.
5. Switch to Jonas, Priya and Leo to compare organization roles and approval steps.
6. Create a bearer key at `/business/developers`, query the read API, revoke it, then verify rejection.
7. Enter as operations staff. Save a review with notes and inspect the audit trail. Run authorized reconciliation.
8. Inspect journal posting counts and run the automated safety tests.

## Resume description

Extended a TypeScript/Next.js fintech sandbox with database-enforced ledger immutability, atomic idempotent transfers, exact currency calculations, role-guarded operations and a hashed-key read API; added financial regression tests and documented architecture and release gaps.

## Engineering discussion points

- Ledger posting signs versus customer-facing normal balances.
- Deterministic rounding across currency exponents.
- Atomic idempotency claims and money movement.
- Holds during asynchronous processing.
- Reversals through compensating journals and projection updates.
- Staff permission versus account ownership.
- SQLite writer serialization versus PostgreSQL row locking.
- Database invariants versus domain and API validation.
- Internal event replay versus verified external delivery.

No browser screenshots, accessibility scores, Lighthouse results or Core Web Vitals were collected in this batch. Do not attach invented performance or security claims to this case study.
