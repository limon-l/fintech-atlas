import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type Database from "better-sqlite3";
import { createDatabase, migrate } from "@/db/migrate";
import { seedDatabase } from "@/db/seed";
import { accountBalance, postJournal, reverseJournal, writeTransaction } from "./ledger";
import { convertMinor, parseMoneyToMinor, sumMinor } from "./money";
import { createQuote, createTransfer, settleTransfer } from "@/server/transfers";
import { assertAccountAccess } from "./access";
import { canBusiness, canPlatform } from "./rbac";
import type { SessionUser } from "./identity";
import { authenticateApi } from "@/server/api";
import { createApiKey, runReconciliation, getLatestReconciliation } from "@/server/ops";

const maya: SessionUser = { id: "usr_maya", email: "maya@atlas.demo", name: "Maya Chen", initials: "MC", platformRole: "customer", kycStatus: "verified", status: "active", country: "GB", memberships: [] };
let db: Database.Database;
beforeEach(() => { db = createDatabase(":memory:"); migrate(db); seedDatabase(db); });
afterEach(() => db.close());
const transfer = (overrides = {}) => createTransfer(db, { user: maya, sourceAccountId: "acc_maya_usd", direction: "internal", amountMinor: 5000, destinationAccountId: "acc_maya_savings", idempotencyKey: "test-transfer-key", requestHash: "canonical-request-hash", pinVerified: true, ...overrides });

describe("exact monetary calculations", () => {
  it("parses currency precision without rounding", () => {
    expect(parseMoneyToMinor("0.29", "USD")).toBe(29);
    expect(parseMoneyToMinor("1.234", "KWD")).toBe(1234);
    expect(() => parseMoneyToMinor("1.1", "JPY")).toThrow();
    expect(() => parseMoneyToMinor("0.001", "USD")).toThrow();
  });
  it("converts across zero and three decimal currencies", () => {
    expect(convertMinor(100, "USD", "JPY", "151.42")).toBe(151);
    expect(convertMinor(100, "USD", "KWD", "0.3072")).toBe(307);
  });
  it("rejects intermediate overflow even if later values cancel", () => {
    expect(() => sumMinor([Number.MAX_SAFE_INTEGER, 1, -1])).toThrow();
  });
});

describe("ledger and transfer integrity", () => {
  it("seeds balanced journals for every currency", () => {
    expect(db.prepare("SELECT journal_id FROM postings GROUP BY journal_id, currency HAVING SUM(amount_minor) <> 0").all()).toEqual([]);
  });
  it("replays a transfer exactly once and rejects changed payloads", () => {
    const before = accountBalance(db, "acc_maya_usd").availableMinor;
    const first = transfer();
    expect(transfer()).toMatchObject({ transferId: first.transferId, idempotentReplay: true });
    expect(accountBalance(db, "acc_maya_usd").availableMinor).toBe(before - 5000);
    expect(() => transfer({ amountMinor: 6000, requestHash: "changed" })).toThrow();
  });
  it("rolls back insufficient funds including its idempotency claim", () => {
    const before = accountBalance(db, "acc_maya_usd");
    expect(() => transfer({ amountMinor: Number.MAX_SAFE_INTEGER })).toThrow();
    expect(accountBalance(db, "acc_maya_usd")).toEqual(before);
    expect(db.prepare("SELECT id FROM idempotency_keys WHERE key = 'test-transfer-key'").get()).toBeUndefined();
  });
  it("requires authorization and isolates customer accounts", () => {
    expect(() => transfer({ pinVerified: false })).toThrow();
    expect(() => assertAccountAccess(db, { ...maya, id: "usr_alex" }, "acc_maya_usd", "account:transfer")).toThrow();
  });
  it("reserves external funds until settlement and prevents duplicate settlement", () => {
    const before = accountBalance(db, "acc_maya_gbp");
    const result = transfer({ sourceAccountId: "acc_maya_gbp", direction: "external", destinationAccountId: undefined, beneficiaryId: "ben_kwame", amountMinor: 1000 });
    expect(result.status).toBe("processing");
    const held = accountBalance(db, "acc_maya_gbp");
    expect(held.ledgerMinor).toBe(before.ledgerMinor);
    expect(held.heldMinor).toBe(before.heldMinor + 1000 + result.feeMinor);
    settleTransfer(db, result.transferId, maya);
    expect(accountBalance(db, "acc_maya_gbp").heldMinor).toBe(before.heldMinor);
    expect(() => settleTransfer(db, result.transferId, maya)).toThrow();
  });
  it("rejects expired FX quotes", () => {
    const quote = createQuote(db, maya, "acc_maya_usd", "EUR", 50000);
    db.prepare("UPDATE fx_quotes SET expires_at = '2000-01-01T00:00:00.000Z' WHERE id = ?").run(quote.id);
    expect(() => transfer({ direction: "fx", amountMinor: 50000, destinationAccountId: "acc_maya_eur", quoteId: quote.id })).toThrow();
  });
  it("blocks updates, deletes and appends to posted journals at database level", () => {
    const posting = db.prepare("SELECT * FROM postings LIMIT 1").get() as { id: string; journal_id: string; ledger_account_id: string; currency: string; created_at: string };
    expect(() => db.prepare("UPDATE postings SET amount_minor = 1 WHERE id = ?").run(posting.id)).toThrow();
    expect(() => db.prepare("DELETE FROM postings WHERE id = ?").run(posting.id)).toThrow();
    expect(() => db.prepare("INSERT INTO postings VALUES ('illegal', ?, ?, ?, 1, ?)").run(posting.journal_id, posting.ledger_account_id, posting.currency, posting.created_at)).toThrow();
  });
  it("reverses with compensating postings once", () => {
    const before = accountBalance(db, "acc_maya_usd").ledgerMinor;
    const result = transfer();
    writeTransaction(db, () => reverseJournal(db, result.journalId!));
    expect(accountBalance(db, "acc_maya_usd").ledgerMinor).toBe(before);
    expect(() => writeTransaction(db, () => reverseJournal(db, result.journalId!))).toThrow();
  });
  it("rejects unbalanced journals atomically", () => {
    const rows = db.prepare("SELECT id FROM ledger_accounts WHERE currency = 'USD' LIMIT 2").all() as { id: string }[];
    expect(() => writeTransaction(db, () => postJournal(db, { description: "invalid", kind: "adjustment", postings: [{ ledgerAccountId: rows[0].id, amountMinor: 100 }, { ledgerAccountId: rows[1].id, amountMinor: -99 }] }))).toThrow();
  });
  it("keeps staff fund authority separate from business approval", () => {
    expect(canPlatform("support", "ops:reconcile")).toBe(false);
    expect(canBusiness("employee", "approval:decide")).toBe(false);
    expect(canBusiness("approver", "bill:pay")).toBe(false);
  });
  it("authenticates hashed sandbox keys and rejects revoked keys", () => {
    const admin = { ...maya, id: "usr_admin", platformRole: "super_admin" as const };
    const issued = createApiKey(db, admin, "test key");
    const request = new Request("http://localhost/api/v1/accounts", { headers: { Authorization: `Bearer ${issued.key}` } });
    expect(authenticateApi(db, request).id).toBe("usr_admin");
    const stored = db.prepare("SELECT key_hash FROM api_keys WHERE id = ?").get(issued.id) as { key_hash: string };
    expect(stored.key_hash).not.toContain(issued.key);
    db.prepare("UPDATE api_keys SET revoked_at = ? WHERE id = ?").run(new Date().toISOString(), issued.id);
    expect(() => authenticateApi(db, request)).toThrow();
    expect(() => authenticateApi(db, new Request("http://localhost/api/v1/accounts"))).toThrow();
  });
  it("prevents nonstaff reconciliation and persists authorized results", () => {
    expect(() => runReconciliation(db, maya)).toThrow();
    const result = runReconciliation(db, { ...maya, id: "usr_admin", platformRole: "super_admin" });
    expect(getLatestReconciliation(db).history.some(run => run.id === result.runId)).toBe(true);
  });
  it("protects audit records from mutation", () => {
    const row = db.prepare("SELECT id FROM audit_events LIMIT 1").get() as { id: string };
    expect(() => db.prepare("DELETE FROM audit_events WHERE id = ?").run(row.id)).toThrow();
    expect(() => db.prepare("UPDATE audit_events SET action = 'tampered' WHERE id = ?").run(row.id)).toThrow();
  });
});
