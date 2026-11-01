import type Database from "better-sqlite3";
import { DomainError } from "@/domain/errors";
import { canBusiness } from "@/domain/rbac";
import { recordAudit, writeTransaction } from "@/domain/ledger";
import { createTransfer } from "@/server/transfers";
import type { SessionUser } from "@/domain/identity";
import { newId } from "@/lib/utils";
import { sha256 } from "@/lib/password";

export interface NotificationView {
  id: string;
  title: string;
  body: string;
  kind: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
}

export function notificationsForUser(
  db: Database.Database,
  userId: string,
  limit = 8,
): NotificationView[] {
  return (
    db
      .prepare(
        `SELECT id, title, body, kind, href, read_at, created_at FROM notifications
         WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
      )
      .all(userId, limit) as Array<{
      id: string;
      title: string;
      body: string;
      kind: string;
      href: string | null;
      read_at: string | null;
      created_at: string;
    }>
  ).map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    kind: row.kind,
    href: row.href,
    readAt: row.read_at,
    createdAt: row.created_at,
  }));
}

export function unreadNotificationCount(db: Database.Database, userId: string): number {
  return (
    db
      .prepare("SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND read_at IS NULL")
      .get(userId) as { count: number }
  ).count;
}

export function markNotificationRead(db: Database.Database, userId: string, id: string): void {
  db.prepare("UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ?").run(
    new Date().toISOString(),
    id,
    userId,
  );
}

export function markAllNotificationsRead(db: Database.Database, userId: string): void {
  db.prepare("UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL").run(
    new Date().toISOString(),
    userId,
  );
}

function assertCardAccess(
  db: Database.Database,
  user: SessionUser,
  card: { owner_type: string; owner_id: string },
): void {
  if (card.owner_type === "user" && card.owner_id === user.id) return;
  if (card.owner_type === "org") {
    const membership = db
      .prepare("SELECT role FROM memberships WHERE org_id = ? AND user_id = ? AND status = 'active'")
      .get(card.owner_id, user.id) as { role: "owner" | "finance_manager" | "approver" | "employee" } | undefined;
    if (membership && canBusiness(membership.role, "card:control")) return;
  }
  throw new DomainError("FORBIDDEN", "You cannot control this card");
}

export function updateCardControls(
  db: Database.Database,
  user: SessionUser,
  input: {
    cardId: string;
    status?: "active" | "frozen";
    monthlyLimitMinor?: number;
    perTxnLimitMinor?: number;
  },
): void {
  writeTransaction(db, () => {
    const card = db
      .prepare(
        `SELECT id, owner_type, owner_id, label, status, monthly_limit_minor, per_txn_limit_minor, currency
         FROM cards WHERE id = ?`,
      )
      .get(input.cardId) as
      | {
          id: string;
          owner_type: string;
          owner_id: string;
          label: string;
          status: string;
          monthly_limit_minor: number;
          per_txn_limit_minor: number;
          currency: string;
        }
      | undefined;
    if (!card) throw new DomainError("NOT_FOUND", "Card not found");
    assertCardAccess(db, user, card);
    if (card.status === "canceled") throw new DomainError("CONFLICT", "Canceled cards cannot be modified");

    if (input.monthlyLimitMinor !== undefined) {
      if (!Number.isSafeInteger(input.monthlyLimitMinor) || input.monthlyLimitMinor <= 0) {
        throw new DomainError("VALIDATION_ERROR", "Monthly limit must be a positive amount");
      }
      if (input.perTxnLimitMinor !== undefined && input.perTxnLimitMinor > input.monthlyLimitMinor) {
        throw new DomainError("VALIDATION_ERROR", "Per-transaction limit cannot exceed the monthly limit");
      }
    }
    if (input.perTxnLimitMinor !== undefined) {
      if (!Number.isSafeInteger(input.perTxnLimitMinor) || input.perTxnLimitMinor <= 0) {
        throw new DomainError("VALIDATION_ERROR", "Per-transaction limit must be a positive amount");
      }
      const monthly = input.monthlyLimitMinor ?? card.monthly_limit_minor;
      if (input.perTxnLimitMinor > monthly) {
        throw new DomainError("VALIDATION_ERROR", "Per-transaction limit cannot exceed the monthly limit");
      }
    }

    const status = input.status ?? (card.status as "active" | "frozen");
    db.prepare(
      `UPDATE cards SET status = ?, monthly_limit_minor = ?, per_txn_limit_minor = ?,
       frozen_at = CASE WHEN ? = 'frozen' THEN COALESCE(frozen_at, ?) ELSE NULL END WHERE id = ?`,
    ).run(
      status,
      input.monthlyLimitMinor ?? card.monthly_limit_minor,
      input.perTxnLimitMinor ?? card.per_txn_limit_minor,
      status,
      new Date().toISOString(),
      card.id,
    );

    recordAudit(db, {
      actorId: user.id,
      actorRole: user.platformRole,
      action: status === "frozen" && card.status !== "frozen" ? "card.frozen" : "card.controls_updated",
      resourceType: "card",
      resourceId: card.id,
      metadata: {
        status,
        monthlyLimitMinor: input.monthlyLimitMinor ?? card.monthly_limit_minor,
        perTxnLimitMinor: input.perTxnLimitMinor ?? card.per_txn_limit_minor,
      },
    });

    if (card.owner_type === "user" && card.owner_id === user.id) {
      db.prepare(
        `INSERT INTO notifications (id, user_id, title, body, kind, href, read_at, created_at)
         VALUES (?, ?, ?, ?, 'card', ?, NULL, ?)`,
      ).run(
        newId("ntf"),
        user.id,
        status === "frozen" ? "Card frozen" : "Card controls updated",
        status === "frozen"
          ? `${card.label} is now frozen. New authorizations will be declined.`
          : `${card.label} controls were updated.`,
        "/app/cards",
        new Date().toISOString(),
      );
    }
  });
}

export function updateBudgetCategory(
  db: Database.Database,
  userId: string,
  input: { categoryId: string; limitMinor: number },
): void {
  if (!Number.isSafeInteger(input.limitMinor) || input.limitMinor < 0) {
    throw new DomainError("VALIDATION_ERROR", "Budget limit must be a positive amount");
  }
  writeTransaction(db, () => {
    const row = db
      .prepare(
        `SELECT bc.id, bc.budget_id, bc.category, b.user_id, b.month
         FROM budget_categories bc JOIN budgets b ON b.id = bc.budget_id
         WHERE bc.id = ? AND b.user_id = ?`,
      )
      .get(input.categoryId, userId) as
      | { id: string; budget_id: string; category: string; user_id: string; month: string }
      | undefined;
    if (!row) throw new DomainError("NOT_FOUND", "Budget category not found");
    db.prepare("UPDATE budget_categories SET limit_minor = ? WHERE id = ?").run(input.limitMinor, row.id);
    const total = db
      .prepare("SELECT COALESCE(SUM(limit_minor), 0) AS total FROM budget_categories WHERE budget_id = ?")
      .get(row.budget_id) as { total: number };
    if (total.total <= 0) throw new DomainError("VALIDATION_ERROR", "A budget needs a positive total limit");
    db.prepare("UPDATE budgets SET total_limit_minor = ? WHERE id = ?").run(total.total, row.budget_id);
    recordAudit(db, {
      actorId: userId,
      action: "budget.category_updated",
      resourceType: "budget",
      resourceId: row.budget_id,
      metadata: { category: row.category, limitMinor: input.limitMinor },
    });
  });
}

export function contributeToGoal(
  db: Database.Database,
  user: SessionUser,
  input: { goalId: string; sourceAccountId: string; amountMinor: number },
): { transferId: string; reference: string } {
  const goal = db
    .prepare(
      `SELECT g.id, g.name, g.status, g.account_id, g.target_minor, g.currency
       FROM goals g WHERE g.id = ? AND g.user_id = ?`,
    )
    .get(input.goalId, user.id) as
    | { id: string; name: string; status: string; account_id: string; target_minor: number; currency: string }
    | undefined;
  if (!goal) throw new DomainError("NOT_FOUND", "Goal not found");
  if (goal.status !== "active") throw new DomainError("CONFLICT", "Only active goals accept contributions");
  if (input.sourceAccountId === goal.account_id) {
    throw new DomainError("VALIDATION_ERROR", "Choose a different funding account");
  }
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) {
    throw new DomainError("VALIDATION_ERROR", "Contribution must be positive");
  }

  const idempotencyKey = newId("goal");
  const requestHash = sha256(
    JSON.stringify({ goal: goal.id, source: input.sourceAccountId, amount: input.amountMinor }),
  );
  const transfer = createTransfer(db, {
    user,
    sourceAccountId: input.sourceAccountId,
    direction: "internal",
    amountMinor: input.amountMinor,
    destinationAccountId: goal.account_id,
    note: `Contribution to ${goal.name}`,
    idempotencyKey,
    requestHash,
    pinVerified: true,
  });

  writeTransaction(db, () => {
    db.prepare(
      `INSERT INTO goal_contributions (id, goal_id, account_id, amount_minor, transfer_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(newId("gct"), goal.id, goal.account_id, input.amountMinor, transfer.transferId, new Date().toISOString());
    const balance = db
      .prepare(
        `SELECT COALESCE(SUM(p.amount_minor), 0) AS signed FROM postings p
         JOIN ledger_accounts la ON la.id = p.ledger_account_id WHERE la.account_id = ?`,
      )
      .get(goal.account_id) as { signed: number };
    if (-balance.signed >= goal.target_minor) {
      db.prepare("UPDATE goals SET status = 'completed' WHERE id = ?").run(goal.id);
    }
    recordAudit(db, {
      actorId: user.id,
      action: "goal.contribution",
      resourceType: "goal",
      resourceId: goal.id,
      metadata: { amountMinor: input.amountMinor, transferId: transfer.transferId },
    });
  });

  return { transferId: transfer.transferId, reference: transfer.reference };
}

export function updateProfile(
  db: Database.Database,
  user: SessionUser,
  input: { name: string; country: string; timezone: string },
): void {
  const name = input.name.trim();
  if (name.length < 2 || name.length > 80) throw new DomainError("VALIDATION_ERROR", "Enter a valid name");
  writeTransaction(db, () => {
    db.prepare("UPDATE users SET name = ?, country = ?, timezone = ? WHERE id = ?").run(
      name,
      input.country.trim().toUpperCase().slice(0, 2) || "GB",
      input.timezone,
      user.id,
    );
    recordAudit(db, {
      actorId: user.id,
      actorRole: user.platformRole,
      action: "profile.updated",
      resourceType: "user",
      resourceId: user.id,
      metadata: { country: input.country, timezone: input.timezone },
    });
  });
}

export function createSupportTicket(
  db: Database.Database,
  user: SessionUser,
  input: { subject: string; priority: "low" | "normal" | "high" },
): string {
  const subject = input.subject.trim();
  if (subject.length < 6) throw new DomainError("VALIDATION_ERROR", "Describe your request in a little more detail");
  const id = newId("sup");
  writeTransaction(db, () => {
    db.prepare(
      `INSERT INTO support_tickets (id, user_id, subject, status, priority, assignee_id, created_at, updated_at)
       VALUES (?, ?, ?, 'open', ?, NULL, ?, ?)`,
    ).run(id, user.id, subject, input.priority, new Date().toISOString(), new Date().toISOString());
    recordAudit(db, {
      actorId: user.id,
      actorRole: user.platformRole,
      action: "support.ticket_created",
      resourceType: "support_ticket",
      resourceId: id,
      metadata: { priority: input.priority },
    });
  });
  return id;
}
