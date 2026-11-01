# Ledger specification

## Purpose

The ledger is the source of truth for every balance in ATLAS. Customer-facing balances, available funds and transfer receipts are derived from journal postings. The ledger does not store a mutable `balance` column on accounts.

## Sign convention

- **Debit** is positive.
- **Credit** is negative.
- Every journal must contain at least two postings.
- For every currency in a journal, the signed postings must sum to zero.

Customer accounts are liabilities. For a customer ledger account:

```text
customer balance = -SUM(postings.amount_minor)
```

A positive posting to a customer liability reduces the customer's balance (money leaves). A negative posting increases it (money arrives).

## Money representation

Amounts are integers in minor units. No floating-point arithmetic is used for financial writes.

| Currency | Exponent | Example minor value |
|---|---|---|
| USD, EUR, GBP | 2 | `$12.50` = `1250` |
| JPY | 0 | `¥1,200` = `1200` |
| KWD, BHD | 3 | `1.234` = `1234` |

Parsing and display helpers live in `src/domain/money.ts`. Unsafe integers are rejected. Running totals are checked for overflow.

FX rates are decimal strings. Quotes use `decimal.js` and round half-up to the target currency's exponent. Display approximations never drive a financial write.

## Journal lifecycle

1. A service opens `writeTransaction` (SQLite immediate).
2. `postJournal` validates postings, currencies and zero-sum balance.
3. A pending journal and its postings are inserted.
4. The journal is updated to `posted`.
5. Database triggers re-check that the journal is balanced, has at least two postings, and was not inserted directly as final.

Posted journals are immutable. Corrections use compensating journals.

## Holds and available funds

An external payout reserves funds before settlement:

```text
available = ledger balance - SUM(active holds)
```

Holds have states `active`, `captured`, `released` and `expired`. A hold can be resolved once. Capturing a hold settles the payout; releasing or expiring it returns available funds.

A hold cannot exceed available funds and must match the account currency.

## Internal transfer

```text
Debit  source customer liability   +amount
Credit destination customer liab.  -amount
```

Both postings are in the same currency. The journal balances and the transfer completes immediately.

## External payout

1. Create an active hold for `amount + fee`.
2. Set the transfer to `processing`.
3. On settlement, capture the hold and post:

```text
Debit  source customer liability      +amount + fee
Credit settlement clearing (asset)    -amount
Credit fee revenue                    -fee
```

The provider settlement event is synthetic. A repeated settlement is rejected.

## FX conversion

An FX quote persists the source amount, target amount, rate, fee and expiry. The quote is consumed inside the transfer transaction.

Source leg:

```text
Debit  source customer liability      +source amount
Credit FX clearing (source currency)  -source amount
```

Target leg:

```text
Debit  FX clearing (target currency)  +target amount
Credit target customer liability      -target amount
```

Fee leg, when present:

```text
Debit  source customer liability      +fee
Credit fee revenue                    -fee
```

Each currency balances independently. FX is only allowed between the customer's own Atlas wallets. External FX payouts are rejected.

## Idempotency

A transfer request includes an idempotency key (at least eight characters) and a server-computed request hash. The key claim, money movement and stored response share one immediate transaction.

- Same key + same hash: return the stored response, no second movement.
- Same key + different hash: conflict.
- New key: execute normally.

This protects against repeated submissions after an uncertain network outcome. It is not a substitute for provider-side idempotency.

## Reversals

Reversal creates a new journal with inverted postings and `reversal_of` set to the original journal. The original journal is never edited. A journal can be reversed once.

Operational reversal requires the `ops:ledger` permission, a reason and the authorization PIN. The reversal writes an audit event.

## Controlled adjustments

Operations can post a controlled adjustment as a new journal:

```text
Debit/Credit  customer account ledger   signed amount
Credit/Debit  settlement clearing       opposite amount
```

The account currency must match, the amount must be non-zero, and a debit cannot exceed available funds. The reason is stored in the journal description and the audit event. Adjustments are not a silent reconciliation write-off.

## Reconciliation

Reconciliation groups posted external payouts by currency and compares them with settled provider events.

- A currency-level difference becomes an exception item.
- A per-transfer difference also becomes an exception item.
- An exception can be marked `investigating` or `resolved` with a note.
- Resolving an item recalculates the run's remaining exception count.
- The ledger is not modified by reconciliation.

## Database guards

Migration `002_ledger_guards.sql` adds triggers that:

- reject updates and deletes on `postings`;
- reject updates to posted `journal_entries`;
- reject direct insertion of a posted journal;
- reject finalizing an unbalanced journal or one with fewer than two postings;
- reject updates and deletes on `audit_events`.

These are defense in depth, not a replacement for domain validation.

## Tests

`src/domain/finance.test.ts` covers:

- minor-unit parsing and precision;
- per-currency journal balancing;
- transfer idempotency replay and conflict;
- insufficient funds rollback;
- hold capture and duplicate settlement rejection;
- FX quote expiry and balancing;
- reversal and immutability;
- reconciliation persistence.

`src/server/ops.test.ts` covers operations permissions, decisions, reconciliation resolution, reversals, adjustments and webhook replay. `src/server/api.test.ts` covers bearer authentication and ownership boundaries.

## Non-claims

- No live provider settlement is implemented.
- No multiprocess concurrency test exists.
- No independent financial or security audit has been performed.
- The ledger is synthetic and must not be used for real money.
