import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type Database from "better-sqlite3";
import { createDatabase, migrate } from "@/db/migrate";
import { seedDatabase } from "@/db/seed";
import { accountBalance } from "@/domain/ledger";
import { canBusiness, canMoveCustomerFunds, canPlatform, type BusinessRole, type Permission, type PlatformRole } from "@/domain/rbac";
import type { SessionUser } from "@/domain/identity";
import { createQuote, createTransfer } from "@/server/transfers";
import { decideApproval, type BusinessActor } from "@/server/business";

const maya: SessionUser = {
  id: "usr_maya",
  email: "maya@atlas.demo",
  name: "Maya Chen",
  initials: "MC",
  platformRole: "customer",
  kycStatus: "verified",
  status: "active",
  country: "GB",
  memberships: [],
};

function actor(id: string, role: BusinessRole): BusinessActor {
  return {
    user: { ...maya, id, platformRole: "customer" },
    orgId: "org_northwind",
    role,
  };
}

let db: Database.Database;
beforeEach(() => {
  db = createDatabase(":memory:");
  migrate(db);
  seedDatabase(db);
});
afterEach(() => db.close());

describe("FX conversion workflow", () => {
  it("posts balanced source, target and fee journals and consumes the quote", () => {
    const quote = createQuote(db, maya, "acc_maya_usd", "EUR", 50_000);
    const sourceBefore = accountBalance(db, "acc_maya_usd");
    const targetBefore = accountBalance(db, "acc_maya_eur");

    const result = createTransfer(db, {
      user: maya,
      sourceAccountId: "acc_maya_usd",
      direction: "fx",
      amountMinor: 50_000,
      destinationAccountId: "acc_maya_eur",
      quoteId: quote.id,
      idempotencyKey: "fx-workflow-key",
      requestHash: "fx-workflow-hash",
      pinVerified: true,
    });

    expect(result.status).toBe("posted");
    expect(result.targetAmountMinor).toBe(quote.targetAmountMinor);
    expect(accountBalance(db, "acc_maya_usd").ledgerMinor).toBe(sourceBefore.ledgerMinor - 50_000);
    expect(accountBalance(db, "acc_maya_eur").ledgerMinor).toBe(
      targetBefore.ledgerMinor + quote.targetAmountMinor,
    );
    expect(
      db.prepare("SELECT status FROM fx_quotes WHERE id = ?").get(quote.id),
    ).toEqual({ status: "used" });

    const journals = db
      .prepare(
        `SELECT j.id, p.currency, SUM(p.amount_minor) AS total
         FROM journal_entries j JOIN postings p ON p.journal_id = j.id
         WHERE j.transfer_id = ? GROUP BY j.id, p.currency`,
      )
      .all(result.transferId) as Array<{ id: string; currency: string; total: number }>;
    expect(journals.length).toBeGreaterThanOrEqual(2);
    expect(journals.every((row) => row.total === 0)).toBe(true);
    expect(new Set(journals.map((row) => row.currency))).toEqual(new Set(["USD", "EUR"]));
  });

  it("rejects an external FX payout instead of pretending to settle it", () => {
    const quote = createQuote(db, maya, "acc_maya_usd", "EUR", 10_000);
    expect(() =>
      createTransfer(db, {
        user: maya,
        sourceAccountId: "acc_maya_usd",
        direction: "fx",
        amountMinor: 10_000,
        destinationAccountId: "acc_maya_eur",
        beneficiaryId: "ben_kwame",
        quoteId: quote.id,
        idempotencyKey: "fx-external-key",
        requestHash: "fx-external-hash",
        pinVerified: true,
      }),
    ).toThrow(/external FX payouts/i);
  });
});

describe("maker-checker approvals", () => {
  it("enforces role order, PIN and a written comment", () => {
    const priya = actor("usr_priya", "finance_manager");
    const leo = actor("usr_leo", "approver");
    const sam = actor("usr_sam", "employee");

    expect(() =>
      decideApproval(db, priya, {
        approvalId: "apr_1",
        decision: "approve",
        comment: "Wrong step role",
        pinVerified: true,
      }),
    ).toThrow(/approver role/i);

    expect(() =>
      decideApproval(db, sam, {
        approvalId: "apr_1",
        decision: "approve",
        comment: "Employee cannot decide",
        pinVerified: true,
      }),
    ).toThrow(/role does not permit|permission/i);

    expect(() =>
      decideApproval(db, leo, {
        approvalId: "apr_1",
        decision: "approve",
        comment: "Missing step-up",
        pinVerified: false,
      }),
    ).toThrow(/step-up/i);

    expect(() =>
      decideApproval(db, leo, {
        approvalId: "apr_1",
        decision: "approve",
        comment: "   ",
        pinVerified: true,
      }),
    ).toThrow(/comment/i);

    decideApproval(db, leo, {
      approvalId: "apr_1",
      decision: "approve",
      comment: "Receipt matches the submitted expense.",
      pinVerified: true,
    });
    expect(
      db.prepare("SELECT status, current_step FROM approval_requests WHERE id = 'apr_1'").get(),
    ).toEqual({ status: "pending", current_step: 2 });
    expect(db.prepare("SELECT status FROM expenses WHERE id = 'exp_1'").get()).toEqual({
      status: "pending",
    });

    decideApproval(db, priya, {
      approvalId: "apr_1",
      decision: "approve",
      comment: "Budget available; approved for reimbursement.",
      pinVerified: true,
    });
    expect(
      db.prepare("SELECT status FROM approval_requests WHERE id = 'apr_1'").get(),
    ).toEqual({ status: "approved" });
    expect(db.prepare("SELECT status FROM expenses WHERE id = 'exp_1'").get()).toEqual({
      status: "approved",
    });
  });

  it("rejects self-approval even when the maker holds the deciding role", () => {
    db.prepare(
      `INSERT INTO approval_requests
        (id, org_id, type, resource_id, title, amount_minor, currency, status, current_step, total_steps, requested_by, created_at, decided_at)
       VALUES ('apr_self', 'org_northwind', 'expense', 'exp_1', 'Self approval attempt', 1000, 'USD', 'pending', 1, 1, 'usr_leo', ?, NULL)`,
    ).run(new Date().toISOString());
    db.prepare(
      `INSERT INTO approval_steps (id, request_id, step_no, role_required, status, decided_by, decided_at, comment)
       VALUES ('aps_self', 'apr_self', 1, 'approver', 'pending', NULL, NULL, NULL)`,
    ).run();

    expect(() =>
      decideApproval(db, actor("usr_leo", "approver"), {
        approvalId: "apr_self",
        decision: "approve",
        comment: "Approving my own request",
        pinVerified: true,
      }),
    ).toThrow(/maker-checker/i);
  });
});

describe("RBAC matrix", () => {
  const platformExpected: Record<PlatformRole, Permission[]> = {
    customer: [],
    support: ["ops:read", "audit:read"],
    risk: ["ops:read", "ops:risk", "audit:read", "report:read"],
    compliance: ["ops:read", "ops:compliance", "audit:read", "report:read"],
    admin: ["ops:read", "ops:reconcile", "ops:ledger", "ops:admin", "audit:read", "dev:manage"],
    super_admin: [
      "ops:read",
      "ops:risk",
      "ops:compliance",
      "ops:reconcile",
      "ops:ledger",
      "ops:admin",
      "audit:read",
      "dev:manage",
      "report:read",
    ],
  };

  it("matches the documented platform role matrix", () => {
    for (const [role, permissions] of Object.entries(platformExpected) as Array<
      [PlatformRole, Permission[]]
    >) {
      for (const permission of permissions) expect(canPlatform(role, permission)).toBe(true);
      expect(canPlatform(role, "org:manage")).toBe(false);
      expect(canPlatform(role, "account:transfer")).toBe(false);
    }
    expect(canPlatform("support", "ops:risk")).toBe(false);
    expect(canPlatform("risk", "ops:compliance")).toBe(false);
    expect(canPlatform("compliance", "ops:ledger")).toBe(false);
    expect(canPlatform("admin", "ops:risk")).toBe(false);
  });

  it("keeps fund movement with customers, not platform staff", () => {
    expect(canMoveCustomerFunds("customer")).toBe(true);
    for (const role of ["support", "risk", "compliance", "admin", "super_admin"] as PlatformRole[]) {
      expect(canMoveCustomerFunds(role)).toBe(false);
    }
  });

  it("keeps business roles scoped to their documented duties", () => {
    expect(canBusiness("owner", "bill:pay")).toBe(true);
    expect(canBusiness("finance_manager", "bill:pay")).toBe(true);
    expect(canBusiness("approver", "bill:pay")).toBe(false);
    expect(canBusiness("employee", "approval:decide")).toBe(false);
    expect(canBusiness("approver", "account:transfer")).toBe(false);
    expect(canBusiness("finance_manager", "team:manage")).toBe(false);
    expect(canBusiness("employee", "expense:submit")).toBe(true);
    expect(canBusiness("approver", "approval:decide")).toBe(true);
  });
});
