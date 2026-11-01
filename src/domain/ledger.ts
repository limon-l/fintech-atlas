import type Database from "better-sqlite3";
import { DomainError } from "./errors";
import { assertSafeMinor, currencyDecimals, minorToDecimalString } from "./money";
import { newId, reference } from "@/lib/utils";

export type LedgerAccountType = "asset" | "liability" | "equity" | "revenue" | "expense";

export interface LedgerAccountRow {
  id: string;
  code: string;
  name: string;
  type: LedgerAccountType;
  currency: string;
  account_id: string | null;
  is_system: number;
}

export interface PostingInput {
  ledgerAccountId: string;
  amountMinor: number;
}

export interface PostJournalInput {
  reference?: string;
  description: string;
  kind:
    | "transfer"
    | "deposit"
    | "fx"
    | "fee"
    | "invoice"
    | "reversal"
    | "card"
    | "goal"
    | "adjustment";
  postings: PostingInput[];
  actorId?: string | null;
  transferId?: string | null;
  invoiceId?: string | null;
  reversalOf?: string | null;
  createdAt?: string;
}

export interface JournalResult {
  journalId: string;
  reference: string;
}

/** Serialized write transaction. SQLite IMMEDIATE prevents read-then-write races. */
export function writeTransaction<T>(db: Database.Database, fn: () => T): T {
  const tx = db.transaction(fn);
  return tx.immediate();
}

export function normalBalanceSign(type: LedgerAccountType): 1 | -1 {
  return type === "asset" || type === "expense" ? 1 : -1;
}

export function getLedgerAccount(db: Database.Database, id: string): LedgerAccountRow {
  const row = db.prepare("SELECT * FROM ledger_accounts WHERE id = ?").get(id) as
    | LedgerAccountRow
    | undefined;
  if (!row) throw new DomainError("NOT_FOUND", "Ledger account not found");
  return row;
}

export function ledgerAccountForAccount(db: Database.Database, accountId: string): LedgerAccountRow {
  const row = db
    .prepare("SELECT * FROM ledger_accounts WHERE account_id = ? AND is_system = 0")
    .get(accountId) as LedgerAccountRow | undefined;
  if (!row) throw new DomainError("NOT_FOUND", "Account ledger is not provisioned");
  return row;
}

export function systemLedger(
  db: Database.Database,
  code: string,
  currency: string,
): LedgerAccountRow {
  const row = db
    .prepare("SELECT * FROM ledger_accounts WHERE code = ? AND currency = ?")
    .get(code, currency) as LedgerAccountRow | undefined;
  if (!row) throw new DomainError("NOT_FOUND", `System ledger ${code}/${currency} is not provisioned`);
  return row;
}

export function ledgerAccountBalance(db: Database.Database, ledgerAccountId: string): number {
  const row = db
    .prepare(
      "SELECT COALESCE(SUM(amount_minor), 0) AS total FROM postings WHERE ledger_account_id = ?",
    )
    .get(ledgerAccountId) as { total: number };
  const account = getLedgerAccount(db, ledgerAccountId);
  return row.total * normalBalanceSign(account.type);
}

export interface AccountBalance {
  accountId: string;
  currency: string;
  ledgerMinor: number;
  heldMinor: number;
  availableMinor: number;
}

export function accountBalance(db: Database.Database, accountId: string): AccountBalance {
  const account = db
    .prepare("SELECT id, currency FROM accounts WHERE id = ?")
    .get(accountId) as { id: string; currency: string } | undefined;
  if (!account) throw new DomainError("NOT_FOUND", "Account not found");
  const ledger = ledgerAccountForAccount(db, accountId);
  const ledgerMinor = ledgerAccountBalance(db, ledger.id);
  const held = db
    .prepare(
      "SELECT COALESCE(SUM(amount_minor), 0) AS total FROM holds WHERE account_id = ? AND status = 'active'",
    )
    .get(accountId) as { total: number };
  return {
    accountId,
    currency: account.currency,
    ledgerMinor,
    heldMinor: held.total,
    availableMinor: ledgerMinor - held.total,
  };
}

/**
 * Posts an immutable, balanced journal entry.
 * Must be called inside a writeTransaction. Balances are enforced both here and
 * by a database trigger on journal_entries.status -> 'posted'.
 */
export function postJournal(db: Database.Database, input: PostJournalInput): JournalResult {
  if (input.postings.length < 2) {
    throw new DomainError("VALIDATION_ERROR", "A journal entry requires at least two postings");
  }

  const byCurrency = new Map<string, number>();
  for (const posting of input.postings) {
    assertSafeMinor(posting.amountMinor, "posting amount");
    if (posting.amountMinor === 0) {
      throw new DomainError("VALIDATION_ERROR", "Zero-value postings are not permitted");
    }
    const account = getLedgerAccount(db, posting.ledgerAccountId);
    const total = (byCurrency.get(account.currency) ?? 0) + posting.amountMinor;
    assertSafeMinor(total, "journal total");
    byCurrency.set(account.currency, total);
  }
  for (const [currency, total] of byCurrency) {
    if (total !== 0) {
      throw new DomainError(
        "VALIDATION_ERROR",
        `Journal is unbalanced for ${currency}: ${minorToDecimalString(total, currency)}`,
      );
    }
  }

  const journalId = newId("jrn");
  const createdAt = input.createdAt ?? new Date().toISOString();
  const ref = input.reference ?? reference("JRN");

  db.prepare(
    `INSERT INTO journal_entries
      (id, reference, description, kind, status, transfer_id, invoice_id, reversal_of, actor_id, created_at)
     VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)`,
  ).run(
    journalId,
    ref,
    input.description,
    input.kind,
    input.transferId ?? null,
    input.invoiceId ?? null,
    input.reversalOf ?? null,
    input.actorId ?? null,
    createdAt,
  );

  const insertPosting = db.prepare(
    `INSERT INTO postings (id, journal_id, ledger_account_id, currency, amount_minor, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  for (const posting of input.postings) {
    const account = getLedgerAccount(db, posting.ledgerAccountId);
    insertPosting.run(
      newId("pst"),
      journalId,
      posting.ledgerAccountId,
      account.currency,
      posting.amountMinor,
      createdAt,
    );
  }

  // Trigger validates zero-sum per currency and minimum posting count.
  db.prepare("UPDATE journal_entries SET status = 'posted', posted_at = ? WHERE id = ?").run(
    createdAt,
    journalId,
  );

  return { journalId, reference: ref };
}

export function reverseJournal(
  db: Database.Database,
  journalId: string,
  options: { actorId?: string; description?: string } = {},
): JournalResult {
  const original = db
    .prepare("SELECT * FROM journal_entries WHERE id = ?")
    .get(journalId) as
    | { id: string; status: string; description: string; kind: string; transfer_id: string | null }
    | undefined;
  if (!original) throw new DomainError("NOT_FOUND", "Journal not found");
  if (original.status !== "posted") {
    throw new DomainError("CONFLICT", "Only posted journals can be reversed");
  }
  const existing = db
    .prepare("SELECT id FROM journal_entries WHERE reversal_of = ?")
    .get(journalId);
  if (existing) throw new DomainError("CONFLICT", "Journal has already been reversed");

  const postings = db
    .prepare("SELECT ledger_account_id, amount_minor FROM postings WHERE journal_id = ?")
    .all(journalId) as { ledger_account_id: string; amount_minor: number }[];

  return postJournal(db, {
    description: options.description ?? `Reversal of ${original.description}`,
    kind: "reversal",
    transferId: original.transfer_id,
    actorId: options.actorId,
    reversalOf: journalId,
    postings: postings.map((p) => ({
      ledgerAccountId: p.ledger_account_id,
      amountMinor: -p.amount_minor,
    })),
  });
}

export interface HoldRow {
  id: string;
  account_id: string;
  amount_minor: number;
  currency: string;
  status: "active" | "captured" | "released" | "expired";
  transfer_id: string | null;
  reason: string | null;
  created_at: string;
  resolved_at: string | null;
}

export function createHold(
  db: Database.Database,
  input: {
    accountId: string;
    amountMinor: number;
    currency: string;
    transferId?: string;
    reason: string;
  },
): string {
  assertSafeMinor(input.amountMinor, "hold amount");
  if (input.amountMinor <= 0) throw new DomainError("VALIDATION_ERROR", "Hold amount must be positive");
  const balance = accountBalance(db, input.accountId);
  if (balance.currency !== input.currency) {
    throw new DomainError("VALIDATION_ERROR", "Hold currency does not match account currency");
  }
  if (balance.availableMinor < input.amountMinor) {
    throw new DomainError("INSUFFICIENT_FUNDS", "Available balance is insufficient for this hold");
  }
  const id = newId("hld");
  db.prepare(
    `INSERT INTO holds (id, account_id, amount_minor, currency, status, transfer_id, reason, created_at)
     VALUES (?, ?, ?, ?, 'active', ?, ?, ?)`,
  ).run(
    id,
    input.accountId,
    input.amountMinor,
    input.currency,
    input.transferId ?? null,
    input.reason,
    new Date().toISOString(),
  );
  return id;
}

export function resolveHold(
  db: Database.Database,
  holdId: string,
  resolution: "captured" | "released" | "expired",
): void {
  const result = db
    .prepare(
      "UPDATE holds SET status = ?, resolved_at = ? WHERE id = ? AND status = 'active'",
    )
    .run(resolution, new Date().toISOString(), holdId);
  if (result.changes !== 1) {
    throw new DomainError("HOLD_STATE", "Hold is not active and cannot be resolved twice");
  }
}

export function getHold(db: Database.Database, holdId: string): HoldRow {
  const row = db.prepare("SELECT * FROM holds WHERE id = ?").get(holdId) as HoldRow | undefined;
  if (!row) throw new DomainError("NOT_FOUND", "Hold not found");
  return row;
}

export interface AuditInput {
  actorId?: string | null;
  actorRole?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  orgId?: string | null;
  ip?: string | null;
  requestId?: string | null;
  metadata?: Record<string, unknown>;
}

export function recordAudit(db: Database.Database, input: AuditInput): void {
  db.prepare(
    `INSERT INTO audit_events
      (id, actor_id, actor_role, action, resource_type, resource_id, org_id, ip, request_id, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    newId("aud"),
    input.actorId ?? null,
    input.actorRole ?? null,
    input.action,
    input.resourceType,
    input.resourceId ?? null,
    input.orgId ?? null,
    input.ip ?? null,
    input.requestId ?? null,
    JSON.stringify(input.metadata ?? {}),
    new Date().toISOString(),
  );
}

export function currencyMinorLabel(amountMinor: number, currency: string): string {
  return `${minorToDecimalString(amountMinor, currency)} ${currency}`;
}

export function decimalsFor(currency: string): number {
  return currencyDecimals(currency);
}
