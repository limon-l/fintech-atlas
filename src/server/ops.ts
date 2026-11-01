import type Database from "better-sqlite3";
import { DomainError } from "@/domain/errors";
import type { SessionUser } from "@/domain/identity";
import { canPlatform, type Permission } from "@/domain/rbac";
import { postJournal, recordAudit, reverseJournal, writeTransaction } from "@/domain/ledger";
import { newId, reference } from "@/lib/utils";
import { randomToken, sha256 } from "@/lib/password";

function assertOps(user: SessionUser, permission: Permission): void {
  if (!canPlatform(user.platformRole, permission)) {
    throw new DomainError("FORBIDDEN", "Operations permission required");
  }
}

export interface OpsOverview {
  customers: number;
  organizations: number;
  accounts: number;
  journals: number;
  postings: number;
  volumeUsdMinor: number;
  openRisk: number;
  criticalRisk: number;
  pendingCases: number;
  pendingApprovals: number;
  reconciliationExceptions: number;
  failedProviderEvents: number;
  lastReconciliation: { id: string; completedAt: string | null; exceptions: number } | null;
  recentAudit: AuditRow[];
}

export interface AuditRow {
  id: string;
  actorId: string | null;
  actorName: string | null;
  actorRole: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  orgId: string | null;
  ip: string | null;
  requestId: string | null;
  metadata: string;
  createdAt: string;
}

export function getOpsOverview(db: Database.Database): OpsOverview {
  const count = (table: string, where = "1=1", params: unknown[] = []) =>
    (db.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE ${where}`).get(...params) as { count: number }).count;
  const volume = db
    .prepare(
      `SELECT COALESCE(SUM(amount_minor), 0) AS total FROM transactions
       WHERE status = 'posted' AND currency = 'USD'`,
    )
    .get() as { total: number };
  const lastRun = db
    .prepare(
      "SELECT id, completed_at, exception_count FROM reconciliation_runs ORDER BY started_at DESC LIMIT 1",
    )
    .get() as { id: string; completed_at: string | null; exception_count: number } | undefined;
  const pendingApprovals = db
    .prepare("SELECT COUNT(*) AS count FROM approval_requests WHERE status = 'pending'")
    .get() as { count: number };
  const failedProvider = db
    .prepare("SELECT COUNT(*) AS count FROM provider_events WHERE status = 'failed'")
    .get() as { count: number };
  return {
    customers: count("users", "platform_role = 'customer'"),
    organizations: count("organizations"),
    accounts: count("accounts"),
    journals: count("journal_entries"),
    postings: count("postings"),
    volumeUsdMinor: volume.total,
    openRisk: count("risk_events", "status IN ('open','reviewing')"),
    criticalRisk: count("risk_events", "severity = 'critical' AND status IN ('open','reviewing')"),
    pendingCases: count("compliance_cases", "status IN ('open','reviewing','info_requested')"),
    pendingApprovals: pendingApprovals.count,
    reconciliationExceptions: lastRun?.exception_count ?? 0,
    failedProviderEvents: failedProvider.count,
    lastReconciliation: lastRun
      ? { id: lastRun.id, completedAt: lastRun.completed_at, exceptions: lastRun.exception_count }
      : null,
    recentAudit: listAudit(db, { limit: 8 }),
  };
}

export function listCustomers(db: Database.Database, search = "") {
  const like = `%${search}%`;
  return db
    .prepare(
      `SELECT u.id, u.name, u.email, u.initials, u.platform_role, u.status, u.kyc_status, u.country,
              u.created_at, u.last_login_at,
              (SELECT COUNT(*) FROM accounts a WHERE a.owner_type = 'user' AND a.owner_id = u.id) AS account_count,
              (SELECT COUNT(*) FROM compliance_cases c WHERE c.subject_type = 'user' AND c.subject_id = u.id) AS case_count
       FROM users u
       WHERE (u.name LIKE ? OR u.email LIKE ?)
       ORDER BY u.created_at ASC`,
    )
    .all(like, like) as Array<{
    id: string;
    name: string;
    email: string;
    initials: string;
    platform_role: string;
    status: string;
    kyc_status: string;
    country: string;
    created_at: string;
    last_login_at: string | null;
    account_count: number;
    case_count: number;
  }>;
}

export function getCustomer360(db: Database.Database, userId: string) {
  const user = db
    .prepare(
      `SELECT id, name, email, initials, platform_role, status, kyc_status, country, created_at, last_login_at
       FROM users WHERE id = ?`,
    )
    .get(userId) as Record<string, unknown> | undefined;
  if (!user) return null;
  const accounts = db
    .prepare(
      `SELECT a.id, a.name, a.currency, a.status, a.owner_type,
              (SELECT COALESCE(SUM(p.amount_minor), 0) FROM postings p
                JOIN ledger_accounts la ON la.id = p.ledger_account_id
                WHERE la.account_id = a.id) AS ledger_signed
       FROM accounts a WHERE a.owner_type = 'user' AND a.owner_id = ?`,
    )
    .all(userId) as Array<Record<string, unknown>>;
  const cases = db
    .prepare("SELECT * FROM compliance_cases WHERE subject_type = 'user' AND subject_id = ? ORDER BY created_at DESC")
    .all(userId);
  const risk = db
    .prepare("SELECT * FROM risk_events WHERE user_id = ? ORDER BY created_at DESC LIMIT 8")
    .all(userId);
  const transactions = db
    .prepare(
      `SELECT t.id, t.direction, t.amount_minor, t.currency, t.status, t.description, t.occurred_at, a.name AS account_name
       FROM transactions t JOIN accounts a ON a.id = t.account_id
       WHERE a.owner_type = 'user' AND a.owner_id = ? ORDER BY t.occurred_at DESC LIMIT 10`,
    )
    .all(userId);
  return { user, accounts, cases, risk, transactions };
}

export function listRiskEvents(db: Database.Database, status?: string) {
  const rows = db
    .prepare(
      `SELECT r.*, u.name AS user_name, a.name AS assignee_name, t.reference AS transfer_reference
       FROM risk_events r
       LEFT JOIN users u ON u.id = r.user_id
       LEFT JOIN users a ON a.id = r.assigned_to
       LEFT JOIN transfers t ON t.id = r.transfer_id
       ${status ? "WHERE r.status = ?" : ""}
       ORDER BY CASE r.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
                r.created_at DESC`,
    )
    .all(...(status ? [status] : [])) as Array<Record<string, unknown>>;
  return rows;
}

export function updateRiskEvent(
  db: Database.Database,
  actor: SessionUser,
  input: { riskId: string; status: "reviewing" | "cleared" | "escalated"; note: string },
): void {
  assertOps(actor, "ops:risk");
  if (!input.note.trim()) throw new DomainError("VALIDATION_ERROR", "Document the review outcome");
  writeTransaction(db, () => {
    const event = db.prepare("SELECT id, status FROM risk_events WHERE id = ?").get(input.riskId) as
      | { id: string; status: string }
      | undefined;
    if (!event) throw new DomainError("NOT_FOUND", "Risk event not found");
    db.prepare("UPDATE risk_events SET status = ?, assigned_to = ?, resolved_at = ? WHERE id = ?").run(
      input.status,
      actor.id,
      input.status === "cleared" ? new Date().toISOString() : null,
      input.riskId,
    );
    recordAudit(db, {
      actorId: actor.id,
      actorRole: actor.platformRole,
      action: `risk.${input.status}`,
      resourceType: "risk_event",
      resourceId: input.riskId,
      metadata: { note: input.note },
    });
  });
}

export function listComplianceCases(db: Database.Database, status?: string) {
  return db
    .prepare(
      `SELECT c.*, u.name AS subject_name, a.name AS assignee_name
       FROM compliance_cases c
       LEFT JOIN users u ON c.subject_type = 'user' AND u.id = c.subject_id
       LEFT JOIN users a ON a.id = c.assigned_to
       ${status ? "WHERE c.status = ?" : ""}
       ORDER BY CASE c.priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END, c.created_at DESC`,
    )
    .all(...(status ? [status] : [])) as Array<Record<string, unknown>>;
}

export function updateComplianceCase(
  db: Database.Database,
  actor: SessionUser,
  input: { caseId: string; status: "reviewing" | "info_requested" | "approved" | "rejected"; note: string },
): void {
  assertOps(actor, "ops:compliance");
  if (!input.note.trim()) throw new DomainError("VALIDATION_ERROR", "Document the compliance decision");
  writeTransaction(db, () => {
    const found = db.prepare("SELECT id FROM compliance_cases WHERE id = ?").get(input.caseId);
    if (!found) throw new DomainError("NOT_FOUND", "Compliance case not found");
    db.prepare("UPDATE compliance_cases SET status = ?, assigned_to = ?, updated_at = ? WHERE id = ?").run(
      input.status,
      actor.id,
      new Date().toISOString(),
      input.caseId,
    );
    recordAudit(db, {
      actorId: actor.id,
      actorRole: actor.platformRole,
      action: `compliance.${input.status}`,
      resourceType: "compliance_case",
      resourceId: input.caseId,
      metadata: { note: input.note },
    });
  });
}

export interface ReconciliationItem {
  id: string;
  currency: string;
  ledgerMinor: number;
  providerMinor: number;
  differenceMinor: number;
  status: string;
  transferId: string | null;
  transferReference: string | null;
  note: string;
}

export function getLatestReconciliation(db: Database.Database): {
  run: { id: string; startedAt: string; completedAt: string | null; status: string; itemCount: number; exceptionCount: number; actorName: string | null } | null;
  items: ReconciliationItem[];
  history: Array<{ id: string; startedAt: string; exceptionCount: number; itemCount: number }>;
} {
  const run = db
    .prepare(
      `SELECT r.*, u.name AS actor_name FROM reconciliation_runs r LEFT JOIN users u ON u.id = r.actor_id
       ORDER BY r.started_at DESC LIMIT 1`,
    )
    .get() as
    | {
        id: string;
        started_at: string;
        completed_at: string | null;
        status: string;
        item_count: number;
        exception_count: number;
        actor_name: string | null;
      }
    | undefined;
  const history = (
    db
      .prepare("SELECT id, started_at, exception_count, item_count FROM reconciliation_runs ORDER BY started_at DESC LIMIT 6")
      .all() as Array<{ id: string; started_at: string; exception_count: number; item_count: number }>
  ).map((row) => ({
    id: row.id,
    startedAt: row.started_at,
    exceptionCount: row.exception_count,
    itemCount: row.item_count,
  }));
  if (!run) return { run: null, items: [], history };
  const items = db
    .prepare(
      `SELECT i.*, t.reference AS transfer_reference FROM reconciliation_items i
       LEFT JOIN transfers t ON t.id = i.transfer_id WHERE i.run_id = ? ORDER BY i.difference_minor DESC`,
    )
    .all(run.id) as Array<{
    id: string;
    currency: string;
    ledger_minor: number;
    provider_minor: number;
    difference_minor: number;
    status: string;
    transfer_id: string | null;
    transfer_reference: string | null;
    note: string;
  }>;
  return {
    run: {
      id: run.id,
      startedAt: run.started_at,
      completedAt: run.completed_at,
      status: run.status,
      itemCount: run.item_count,
      exceptionCount: run.exception_count,
      actorName: run.actor_name,
    },
    items: items.map((i) => ({
      id: i.id,
      currency: i.currency,
      ledgerMinor: i.ledger_minor,
      providerMinor: i.provider_minor,
      differenceMinor: i.difference_minor,
      status: i.status,
      transferId: i.transfer_id,
      transferReference: i.transfer_reference,
      note: i.note,
    })),
    history,
  };
}

export function runReconciliation(db: Database.Database, actor: SessionUser): { runId: string; exceptions: number } {
  assertOps(actor, "ops:reconcile");
  return writeTransaction(db, () => {
    const runId = newId("rec");
    const startedAt = new Date().toISOString();
    db.prepare(
      "INSERT INTO reconciliation_runs (id, started_at, completed_at, status, item_count, exception_count, actor_id) VALUES (?, ?, NULL, 'running', 0, 0, ?)",
    ).run(runId, startedAt, actor.id);

    const rows = db
      .prepare(
        `SELECT t.id, t.reference, t.source_currency AS currency, t.source_amount_minor AS ledger_minor,
                COALESCE((SELECT SUM(pe.amount_minor) FROM provider_events pe
                          WHERE pe.transfer_id = t.id AND pe.status = 'settled'), 0) AS provider_minor
         FROM transfers t
         WHERE t.status = 'posted' AND t.direction = 'external'`,
      )
      .all() as Array<{ id: string; reference: string; currency: string; ledger_minor: number; provider_minor: number }>;

    const byCurrency = new Map<string, { ledger: number; provider: number }>();
    for (const row of rows) {
      const current = byCurrency.get(row.currency) ?? { ledger: 0, provider: 0 };
      current.ledger += row.ledger_minor;
      current.provider += row.provider_minor;
      byCurrency.set(row.currency, current);
    }
    const insertItem = db.prepare(
      `INSERT INTO reconciliation_items (id, run_id, currency, ledger_minor, provider_minor, difference_minor, status, transfer_id, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    let exceptions = 0;
    let itemCount = 0;
    for (const [currency, totals] of byCurrency) {
      const difference = totals.ledger - totals.provider;
      const status = difference === 0 ? "matched" : "exception";
      if (difference !== 0) exceptions += 1;
      itemCount += 1;
      insertItem.run(
        newId("rec"),
        runId,
        currency,
        totals.ledger,
        totals.provider,
        difference,
        status,
        null,
        difference === 0
          ? `${currency} payout batch reconciles to provider settlement`
          : `${currency} payout batch has an unexplained difference`,
      );
      for (const row of rows.filter((r) => r.currency === currency && r.provider_minor !== r.ledger_minor)) {
        itemCount += 1;
        insertItem.run(
          newId("rec"),
          runId,
          currency,
          row.ledger_minor,
          row.provider_minor,
          row.ledger_minor - row.provider_minor,
          "exception",
          row.id,
          `Transfer ${row.reference} differs from the provider settlement amount`,
        );
      }
    }
    db.prepare(
      "UPDATE reconciliation_runs SET completed_at = ?, status = 'completed', item_count = ?, exception_count = ? WHERE id = ?",
    ).run(new Date().toISOString(), itemCount, exceptions, runId);
    recordAudit(db, {
      actorId: actor.id,
      actorRole: actor.platformRole,
      action: "reconciliation.completed",
      resourceType: "reconciliation_run",
      resourceId: runId,
      metadata: { items: itemCount, exceptions },
    });
    return { runId, exceptions };
  });
}

export function listAudit(
  db: Database.Database,
  filters: { limit?: number; actorId?: string; action?: string; resourceType?: string } = {},
): AuditRow[] {
  const clauses: string[] = ["1=1"];
  const params: Array<string | number> = [];
  if (filters.actorId) {
    clauses.push("a.actor_id = ?");
    params.push(filters.actorId);
  }
  if (filters.action) {
    clauses.push("a.action LIKE ?");
    params.push(`%${filters.action}%`);
  }
  if (filters.resourceType) {
    clauses.push("a.resource_type = ?");
    params.push(filters.resourceType);
  }
  const limit = Math.min(filters.limit ?? 100, 300);
  const rows = db
    .prepare(
      `SELECT a.id, a.actor_id, u.name AS actor_name, a.actor_role, a.action, a.resource_type, a.resource_id,
              a.org_id, a.ip, a.request_id, a.metadata, a.created_at
       FROM audit_events a LEFT JOIN users u ON u.id = a.actor_id
       WHERE ${clauses.join(" AND ")} ORDER BY a.created_at DESC LIMIT ?`,
    )
    .all(...params, limit) as Array<{
    id: string;
    actor_id: string | null;
    actor_name: string | null;
    actor_role: string | null;
    action: string;
    resource_type: string;
    resource_id: string | null;
    org_id: string | null;
    ip: string | null;
    request_id: string | null;
    metadata: string;
    created_at: string;
  }>;
  return rows.map((row) => ({
    id: row.id,
    actorId: row.actor_id,
    actorName: row.actor_name,
    actorRole: row.actor_role,
    action: row.action,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    orgId: row.org_id,
    ip: row.ip,
    requestId: row.request_id,
    metadata: row.metadata,
    createdAt: row.created_at,
  }));
}

export interface JournalRow {
  id: string;
  reference: string;
  description: string;
  kind: string;
  status: string;
  transferId: string | null;
  transferReference: string | null;
  actorId: string | null;
  createdAt: string;
  postedAt: string | null;
  postingCount: number;
  unbalancedCurrencies: number;
}

export function listJournals(
  db: Database.Database,
  filters: { limit?: number; kind?: string; search?: string } = {},
): JournalRow[] {
  const clauses: string[] = ["1=1"];
  const params: Array<string | number> = [];
  if (filters.kind) {
    clauses.push("je.kind = ?");
    params.push(filters.kind);
  }
  if (filters.search) {
    clauses.push("(je.reference LIKE ? OR je.description LIKE ?)");
    params.push(`%${filters.search}%`, `%${filters.search}%`);
  }
  const limit = Math.min(filters.limit ?? 40, 100);
  const rows = db
    .prepare(
      `SELECT je.id, je.reference, je.description, je.kind, je.status, je.transfer_id, je.actor_id,
              je.created_at, je.posted_at, t.reference AS transfer_reference,
              (SELECT COUNT(*) FROM postings p WHERE p.journal_id = je.id) AS posting_count,
              (SELECT COUNT(*) FROM (
                 SELECT p.currency FROM postings p WHERE p.journal_id = je.id
                 GROUP BY p.currency HAVING SUM(p.amount_minor) <> 0
               )) AS unbalanced_currencies
       FROM journal_entries je LEFT JOIN transfers t ON t.id = je.transfer_id
       WHERE ${clauses.join(" AND ")}
       ORDER BY je.created_at DESC LIMIT ?`,
    )
    .all(...params, limit) as Array<{
    id: string;
    reference: string;
    description: string;
    kind: string;
    status: string;
    transfer_id: string | null;
    actor_id: string | null;
    created_at: string;
    posted_at: string | null;
    transfer_reference: string | null;
    posting_count: number;
    unbalanced_currencies: number;
  }>;
  return rows.map((row) => ({
    id: row.id,
    reference: row.reference,
    description: row.description,
    kind: row.kind,
    status: row.status,
    transferId: row.transfer_id,
    transferReference: row.transfer_reference,
    actorId: row.actor_id,
    createdAt: row.created_at,
    postedAt: row.posted_at,
    postingCount: row.posting_count,
    unbalancedCurrencies: row.unbalanced_currencies,
  }));
}

export function getJournalDetail(db: Database.Database, journalId: string) {
  const journal = db
    .prepare(
      `SELECT je.*, t.reference AS transfer_reference FROM journal_entries je
       LEFT JOIN transfers t ON t.id = je.transfer_id WHERE je.id = ?`,
    )
    .get(journalId) as
    | {
        id: string;
        reference: string;
        description: string;
        kind: string;
        status: string;
        transfer_id: string | null;
        transfer_reference: string | null;
        reversal_of: string | null;
        actor_id: string | null;
        created_at: string;
        posted_at: string | null;
      }
    | undefined;
  if (!journal) return null;
  const postings = db
    .prepare(
      `SELECT p.id, p.amount_minor, p.currency, la.code, la.name, la.type, la.account_id, a.name AS account_name
       FROM postings p JOIN ledger_accounts la ON la.id = p.ledger_account_id
       LEFT JOIN accounts a ON a.id = la.account_id
       WHERE p.journal_id = ? ORDER BY p.amount_minor DESC`,
    )
    .all(journalId) as Array<{
    id: string;
    amount_minor: number;
    currency: string;
    code: string;
    name: string;
    type: string;
    account_id: string | null;
    account_name: string | null;
  }>;
  const reversal = db
    .prepare("SELECT id, reference FROM journal_entries WHERE reversal_of = ?")
    .get(journalId) as { id: string; reference: string } | undefined;
  return { journal, postings, reversal: reversal ?? null };
}

export function reverseJournalByOps(
  db: Database.Database,
  actor: SessionUser,
  journalId: string,
  reason: string,
): void {
  assertOps(actor, "ops:ledger");
  if (!reason.trim()) throw new DomainError("VALIDATION_ERROR", "A correction reason is required");
  writeTransaction(db, () => {
    const reversal = reverseJournal(db, journalId, {
      actorId: actor.id,
      description: `Operations correction — ${reason}`,
    });
    recordAudit(db, {
      actorId: actor.id,
      actorRole: actor.platformRole,
      action: "ledger.reversal_posted",
      resourceType: "journal_entry",
      resourceId: reversal.journalId,
      metadata: { original: journalId, reason },
    });
  });
}

export function getSystemHealth(db: Database.Database) {
  const quick = db.prepare("PRAGMA quick_check").get() as Record<string, string>;
  const pageCount = db.prepare("PRAGMA page_count").get() as Record<string, number>;
  const pageSize = db.prepare("PRAGMA page_size").get() as Record<string, number>;
  const counts = db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM users) AS users,
        (SELECT COUNT(*) FROM accounts) AS accounts,
        (SELECT COUNT(*) FROM journal_entries) AS journals,
        (SELECT COUNT(*) FROM postings) AS postings,
        (SELECT COUNT(*) FROM sessions WHERE revoked_at IS NULL AND expires_at > datetime('now')) AS sessions`,
    )
    .get() as { users: number; accounts: number; journals: number; postings: number; sessions: number };
  const unbalanced = db
    .prepare(
      `SELECT COUNT(*) AS count FROM (
         SELECT journal_id, currency FROM postings GROUP BY journal_id, currency HAVING SUM(amount_minor) <> 0
       )`,
    )
    .get() as { count: number };
  const failedWebhooks = db
    .prepare("SELECT COUNT(*) AS count FROM webhook_events WHERE status = 'failed'")
    .get() as { count: number };
  return {
    database: Object.values(quick)[0] ?? "unknown",
    sizeBytes: (pageCount.page_count ?? 0) * (pageSize.page_size ?? 0),
    counts,
    unbalancedJournals: unbalanced.count,
    failedWebhooks: failedWebhooks.count,
    uptimeSeconds: Math.round(process.uptime()),
    nodeVersion: process.version,
    generatedAt: new Date().toISOString(),
  };
}

export function listSupportTickets(db: Database.Database) {
  return db
    .prepare(
      `SELECT s.*, u.name AS user_name, a.name AS assignee_name
       FROM support_tickets s LEFT JOIN users u ON u.id = s.user_id
       LEFT JOIN users a ON a.id = s.assignee_id
       ORDER BY CASE s.priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END, s.updated_at DESC`,
    )
    .all() as Array<Record<string, unknown>>;
}

export function listProviderEvents(db: Database.Database) {
  return db
    .prepare(
      `SELECT pe.*, t.reference AS transfer_reference FROM provider_events pe
       LEFT JOIN transfers t ON t.id = pe.transfer_id ORDER BY pe.created_at DESC LIMIT 50`,
    )
    .all() as Array<Record<string, unknown>>;
}

export function listWebhooks(db: Database.Database) {
  return db
    .prepare("SELECT * FROM webhook_events ORDER BY created_at DESC LIMIT 50")
    .all() as Array<Record<string, unknown>>;
}

export function replayWebhook(db: Database.Database, actor: SessionUser, webhookId: string): void {
  if (!canPlatform(actor.platformRole, "dev:manage") && !canPlatform(actor.platformRole, "ops:admin")) {
    throw new DomainError("FORBIDDEN", "Developer administration permission required");
  }
  writeTransaction(db, () => {
    const event = db.prepare("SELECT id, attempts FROM webhook_events WHERE id = ?").get(webhookId) as
      | { id: string; attempts: number }
      | undefined;
    if (!event) throw new DomainError("NOT_FOUND", "Webhook event not found");
    db.prepare(
      "UPDATE webhook_events SET status = 'delivered', attempts = attempts + 1, last_attempt_at = ? WHERE id = ?",
    ).run(new Date().toISOString(), webhookId);
    recordAudit(db, {
      actorId: actor.id,
      actorRole: actor.platformRole,
      action: "webhook.replayed",
      resourceType: "webhook_event",
      resourceId: webhookId,
      metadata: { attempts: event.attempts + 1, simulated: true },
    });
  });
}

export function createApiKey(
  db: Database.Database,
  actor: SessionUser,
  name: string,
): { key: string; prefix: string; id: string } {
  const businessOwner = db
    .prepare(
      `SELECT 1 FROM memberships m JOIN organizations o ON o.id = m.org_id
       WHERE m.user_id = ? AND m.status = 'active' AND m.role IN ('owner','finance_manager') LIMIT 1`,
    )
    .get(actor.id);
  if (!canPlatform(actor.platformRole, "dev:manage") && !businessOwner) {
    throw new DomainError("FORBIDDEN", "Developer administration permission required");
  }
  const secret = `atlas_sk_sandbox_${randomToken(18)}`;
  const prefix = secret.slice(0, 24);
  const id = newId("key");
  writeTransaction(db, () => {
    db.prepare(
      `INSERT INTO api_keys (id, user_id, name, prefix, key_hash, environment, last_used_at, created_at, revoked_at)
       VALUES (?, ?, ?, ?, ?, 'sandbox', NULL, ?, NULL)`,
    ).run(id, actor.id, name, prefix, sha256(secret), new Date().toISOString());
    recordAudit(db, {
      actorId: actor.id,
      actorRole: actor.platformRole,
      action: "api_key.created",
      resourceType: "api_key",
      resourceId: id,
      metadata: { name, prefix },
    });
  });
  return { key: secret, prefix, id };
}

export function listApiKeys(db: Database.Database, userId: string) {
  return db
    .prepare(
      `SELECT id, name, prefix, environment, last_used_at, created_at, revoked_at
       FROM api_keys WHERE user_id = ? ORDER BY created_at DESC`,
    )
    .all(userId) as Array<{
    id: string;
    name: string;
    prefix: string;
    environment: string;
    last_used_at: string | null;
    created_at: string;
    revoked_at: string | null;
  }>;
}

export function getPlatformMetrics(db: Database.Database) {
  const monthly = db
    .prepare(
      `SELECT strftime('%Y-%m', occurred_at) AS month,
              SUM(CASE WHEN direction = 'credit' THEN amount_minor ELSE 0 END) AS inflow,
              SUM(CASE WHEN direction = 'debit' THEN amount_minor ELSE 0 END) AS outflow
       FROM transactions WHERE currency = 'USD' AND status = 'posted'
       GROUP BY month ORDER BY month DESC LIMIT 6`,
    )
    .all() as Array<{ month: string; inflow: number; outflow: number }>;
  return monthly.reverse();
}

export function postAdjustment(
  db: Database.Database,
  actor: SessionUser,
  input: { accountId: string; amountMinor: number; currency: string; reason: string },
): void {
  assertOps(actor, "ops:ledger");
  writeTransaction(db, () => {
    if (!input.reason.trim()) throw new DomainError("VALIDATION_ERROR", "A reason is required");
    const journal = postJournal(db, {
      description: `Controlled adjustment — ${input.reason}`,
      kind: "adjustment",
      actorId: actor.id,
      postings: [
        { ledgerAccountId: `led_${input.accountId}`, amountMinor: input.amountMinor },
        { ledgerAccountId: `led_settlement_${input.currency}`, amountMinor: -input.amountMinor },
      ],
    });
    recordAudit(db, {
      actorId: actor.id,
      actorRole: actor.platformRole,
      action: "ledger.adjustment_posted",
      resourceType: "journal_entry",
      resourceId: journal.journalId,
      metadata: { accountId: input.accountId, amount: input.amountMinor, reason: input.reason },
    });
  });
}

export function createReference(prefix = "REF"): string {
  return reference(prefix);
}
