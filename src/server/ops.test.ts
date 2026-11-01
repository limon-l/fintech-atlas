import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type Database from "better-sqlite3";
import { createDatabase, migrate } from "@/db/migrate";
import { seedDatabase } from "@/db/seed";
import { accountBalance } from "@/domain/ledger";
import type { SessionUser } from "@/domain/identity";
import {
  getLatestReconciliation,
  getOpsOverview,
  listAudit,
  postAdjustment,
  replayWebhook,
  resolveReconciliationItem,
  reverseJournalByOps,
  runReconciliation,
  settlePayoutByOps,
  failPayoutByOps,
  updateComplianceCase,
  updateRiskEvent,
  updateSupportTicket,
} from "./ops";

const base = {
  email: "demo@atlas.demo",
  initials: "DM",
  platformRole: "customer" as const,
  kycStatus: "verified",
  status: "active",
  country: "GB",
  memberships: [],
};

const admin: SessionUser = { ...base, id: "usr_admin", name: "Admin", platformRole: "super_admin" };
const support: SessionUser = { ...base, id: "usr_owen", name: "Owen", platformRole: "support" };
const risk: SessionUser = { ...base, id: "usr_nadia", name: "Nadia", platformRole: "risk" };
const compliance: SessionUser = { ...base, id: "usr_elena", name: "Elena", platformRole: "compliance" };

let db: Database.Database;
beforeEach(() => {
  db = createDatabase(":memory:");
  migrate(db);
  seedDatabase(db);
});
afterEach(() => db.close());

describe("operations permissions", () => {
  it("rejects callers without the required platform permission", () => {
    expect(() => runReconciliation(db, support)).toThrow(/permission/i);
    expect(() => updateRiskEvent(db, support, { riskId: "rsk_1", status: "cleared", note: "checked" })).toThrow(/permission/i);
    expect(() => updateComplianceCase(db, support, { caseId: "cmp_1", status: "approved", note: "checked" })).toThrow(/permission/i);
    expect(() => reverseJournalByOps(db, support, "jrn_missing", "reason")).toThrow(/permission/i);
    expect(() => postAdjustment(db, support, { accountId: "acc_maya_usd", amountMinor: 100, currency: "USD", reason: "test" })).toThrow(/permission/i);
    expect(() => replayWebhook(db, support, "wh_5")).toThrow(/permission/i);
  });
});

describe("risk and compliance decisions", () => {
  it("records a risk outcome with an audit event", () => {
    updateRiskEvent(db, risk, { riskId: "rsk_1", status: "cleared", note: "Velocity matched a payroll run." });
    const row = db.prepare("SELECT status, assigned_to FROM risk_events WHERE id = 'rsk_1'").get() as {
      status: string;
      assigned_to: string;
    };
    expect(row).toEqual({ status: "cleared", assigned_to: "usr_nadia" });
    const audit = listAudit(db, { action: "risk.cleared" });
    expect(audit).toHaveLength(1);
    expect(audit[0]?.resourceId).toBe("rsk_1");
  });

  it("requires a decision note", () => {
    expect(() => updateRiskEvent(db, risk, { riskId: "rsk_1", status: "reviewing", note: "  " })).toThrow(/document/i);
    expect(() => updateComplianceCase(db, compliance, { caseId: "cmp_1", status: "reviewing", note: "" })).toThrow(/document/i);
  });

  it("records a compliance decision", () => {
    updateComplianceCase(db, compliance, {
      caseId: "cmp_1",
      status: "approved",
      note: "Current utility bill received and verified.",
    });
    const row = db.prepare("SELECT status FROM compliance_cases WHERE id = 'cmp_1'").get() as { status: string };
    expect(row.status).toBe("approved");
    expect(listAudit(db, { action: "compliance.approved" })).toHaveLength(1);
  });
});

describe("support queue", () => {
  it("lets a support agent update status and priority with an audit record", () => {
    updateSupportTicket(db, support, { ticketId: "sup_1", status: "resolved", priority: "low" });
    const row = db.prepare("SELECT status, priority, assignee_id FROM support_tickets WHERE id = 'sup_1'").get() as {
      status: string;
      priority: string;
      assignee_id: string;
    };
    expect(row).toEqual({ status: "resolved", priority: "low", assignee_id: "usr_owen" });
    const audit = listAudit(db, { action: "support.ticket_updated" }).filter((event) => event.resourceId === "sup_1");
    expect(audit).toHaveLength(1);
    expect(audit[0]?.actorId).toBe("usr_owen");
  });

  it("rejects unknown tickets", () => {
    expect(() => updateSupportTicket(db, support, { ticketId: "sup_missing", status: "open", priority: "normal" })).toThrow(/not found/i);
  });
});

describe("reconciliation", () => {
  it("runs a new reconciliation and keeps differences explicit", () => {
    const before = getOpsOverview(db);
    const result = runReconciliation(db, admin);
    expect(result.runId).toMatch(/^rec_/);
    expect(result.exceptions).toBeGreaterThanOrEqual(1);
    const latest = getLatestReconciliation(db);
    expect(latest.run?.id).toBe(result.runId);
    expect(latest.items.some((item) => item.currency === "USD" && item.differenceMinor === 1_250)).toBe(true);
    expect(getOpsOverview(db).journals).toBe(before.journals);
  });

  it("resolves an exception and recalculates the run count", () => {
    const result = runReconciliation(db, admin);
    const latest = getLatestReconciliation(db);
    const exception = latest.items.find((item) => item.status === "exception");
    expect(exception).toBeDefined();
    resolveReconciliationItem(db, admin, {
      itemId: exception!.id,
      status: "resolved",
      note: "Provider fee accepted and booked to fee expense.",
    });
    const after = getLatestReconciliation(db);
    expect(after.items.find((item) => item.id === exception!.id)?.status).toBe("resolved");
    expect(after.run?.exceptionCount).toBe(latest.run!.exceptionCount - 1);
    expect(after.run?.id).toBe(result.runId);
  });

  it("requires a note before resolving", () => {
    const latest = getLatestReconciliation(db);
    const item = latest.items[0]!;
    expect(() => resolveReconciliationItem(db, admin, { itemId: item.id, status: "resolved", note: " " })).toThrow(/document/i);
  });
});

describe("ledger controls", () => {
  it("posts a reversal without editing the original journal", () => {
    const original = db
      .prepare(
        `SELECT id FROM journal_entries
         WHERE status = 'posted' AND id NOT IN (SELECT reversal_of FROM journal_entries WHERE reversal_of IS NOT NULL)
         LIMIT 1`,
      )
      .get() as { id: string };
    const countBefore = (db.prepare("SELECT COUNT(*) AS count FROM journal_entries").get() as { count: number }).count;
    reverseJournalByOps(db, admin, original.id, "Duplicate payout correction");
    const countAfter = (db.prepare("SELECT COUNT(*) AS count FROM journal_entries").get() as { count: number }).count;
    expect(countAfter).toBe(countBefore + 1);
    const reversal = db.prepare("SELECT id, status FROM journal_entries WHERE reversal_of = ?").get(original.id) as {
      id: string;
      status: string;
    };
    expect(reversal.status).toBe("posted");
    expect(() => reverseJournalByOps(db, admin, original.id, "again")).toThrow(/already been reversed/i);
    expect(listAudit(db, { action: "ledger.reversal_posted" })).toHaveLength(1);
  });

  it("posts a balanced controlled adjustment and changes the customer balance", () => {
    const before = accountBalance(db, "acc_maya_usd");
    postAdjustment(db, admin, { accountId: "acc_maya_usd", amountMinor: 5_000, currency: "USD", reason: "Reconciliation item rec_i2" });
    const after = accountBalance(db, "acc_maya_usd");
    expect(after.ledgerMinor).toBe(before.ledgerMinor - 5_000);
    const journal = listAudit(db, { action: "ledger.adjustment_posted" })[0]!;
    expect(journal.metadata).toContain("Reconciliation item rec_i2");
  });

  it("rejects mismatched currencies and overdrafts", () => {
    expect(() => postAdjustment(db, admin, { accountId: "acc_maya_usd", amountMinor: 100, currency: "EUR", reason: "bad" })).toThrow(/currency/i);
    const balance = accountBalance(db, "acc_maya_usd");
    expect(() =>
      postAdjustment(db, admin, {
        accountId: "acc_maya_usd",
        amountMinor: balance.availableMinor + 1,
        currency: "USD",
        reason: "overdraft",
      }),
    ).toThrow(/available/i);
    expect(() => postAdjustment(db, admin, { accountId: "acc_maya_usd", amountMinor: 0, currency: "USD", reason: "zero" })).toThrow(/non-zero/i);
  });
});

describe("payout settlement", () => {
  it("releases a failed payout hold without posting money and records the reason", () => {
    const transferId = "trf_maya_gbp_pending";
    const before = accountBalance(db, "acc_maya_gbp");
    expect(() => failPayoutByOps(db, support, transferId, "Provider rejects payout")).toThrow(/permission/i);
    expect(() => failPayoutByOps(db, admin, transferId, " ")).toThrow(/reason/i);
    expect(accountBalance(db, "acc_maya_gbp")).toEqual(before);
    failPayoutByOps(db, admin, transferId, " Provider rejects payout ");
    const row = db.prepare("SELECT status, failure_reason, journal_id, hold_id FROM transfers WHERE id = ?").get(transferId) as {
      status: string; failure_reason: string; journal_id: string | null; hold_id: string;
    };
    expect(row.status).toBe("failed");
    expect(row.failure_reason).toBe("Provider rejects payout");
    expect(row.journal_id).toBeNull();
    expect(db.prepare("SELECT status FROM holds WHERE id = ?").get(row.hold_id)).toEqual({ status: "released" });
    const after = accountBalance(db, "acc_maya_gbp");
    expect(after.ledgerMinor).toBe(before.ledgerMinor);
    expect(after.availableMinor).toBeGreaterThan(before.availableMinor);
    expect(listAudit(db, { action: "transfer.failed" })).toHaveLength(1);
    expect(() => settlePayoutByOps(db, admin, transferId)).toThrow(/processing/i);
    expect(() => failPayoutByOps(db, admin, transferId, "Provider rejects payout")).toThrow(/current state/i);
    expect(accountBalance(db, "acc_maya_gbp")).toEqual(after);
  });

  it("requires ledger authority and settles a processing payout once", () => {
    expect(() => settlePayoutByOps(db, support, "trf_maya_gbp_pending")).toThrow(/permission/i);
    settlePayoutByOps(db, admin, "trf_maya_gbp_pending");
    const transfer = db
      .prepare("SELECT status, settled_at, journal_id FROM transfers WHERE id = 'trf_maya_gbp_pending'")
      .get() as { status: string; settled_at: string | null; journal_id: string | null };
    expect(transfer.status).toBe("posted");
    expect(transfer.settled_at).not.toBeNull();
    expect(transfer.journal_id).not.toBeNull();
    expect(
      db.prepare("SELECT status FROM holds WHERE transfer_id = 'trf_maya_gbp_pending'").get(),
    ).toEqual({ status: "captured" });
    expect(() => settlePayoutByOps(db, admin, "trf_maya_gbp_pending")).toThrow(/processing/i);
  });
});

describe("webhooks", () => {
  it("replays a delivery and increments attempts", () => {
    const before = db.prepare("SELECT attempts, status FROM webhook_events WHERE id = 'wh_5'").get() as {
      attempts: number;
      status: string;
    };
    const auditsBefore = listAudit(db, { action: "webhook.replayed" }).length;
    replayWebhook(db, admin, "wh_5");
    const after = db.prepare("SELECT attempts, status FROM webhook_events WHERE id = 'wh_5'").get() as {
      attempts: number;
      status: string;
    };
    expect(after.attempts).toBe(before.attempts + 1);
    expect(after.status).toBe("delivered");
    const audit = listAudit(db, { action: "webhook.replayed" });
    expect(audit).toHaveLength(auditsBefore + 1);
    expect(audit[0]?.resourceId).toBe("wh_5");
    expect(audit[0]?.actorId).toBe("usr_admin");
  });

  it("rejects unknown events", () => {
    expect(() => replayWebhook(db, admin, "wh_missing")).toThrow(/not found/i);
  });
});
