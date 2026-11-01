import type Database from "better-sqlite3";
import Decimal from "decimal.js";
import { DomainError } from "@/domain/errors";
import type { SessionUser } from "@/domain/identity";
import { assertBusinessPermission, assertAccountAccess } from "@/domain/access";
import type { BusinessRole } from "@/domain/rbac";
import { accountBalance, postJournal, recordAudit, writeTransaction } from "@/domain/ledger";
import { indicativeConvert } from "@/domain/fx";
import { listAccounts, listTransactions, getCashflow, getSpendingByCategory, monthBounds, type AccountView, type CashflowPoint, type CategorySpend, type TransactionView } from "./finance";
import { newId, reference, monthKey } from "@/lib/utils";

export interface BusinessActor {
  user: SessionUser;
  orgId: string;
  role: BusinessRole;
}

function notify(db: Database.Database, userId: string, title: string, body: string, kind: string, href: string) {
  db.prepare(
    `INSERT INTO notifications (id, user_id, title, body, kind, href, read_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL, ?)`,
  ).run(newId("ntf"), userId, title, body, kind, href, new Date().toISOString());
}

function webhook(db: Database.Database, type: string, payload: Record<string, unknown>) {
  db.prepare(
    `INSERT INTO webhook_events (id, type, payload, status, attempts, last_attempt_at, created_at)
     VALUES (?, ?, ?, 'pending', 0, NULL, ?)`,
  ).run(newId("wh"), type, JSON.stringify(payload), new Date().toISOString());
}

/* -------------------------------------------------------------------------- */
/* Overview and reporting                                                     */
/* -------------------------------------------------------------------------- */

export interface BusinessOverview {
  accounts: AccountView[];
  cashUsdMinor: number;
  incomingMinor: number;
  outgoingMinor: number;
  receivablesMinor: number;
  payablesMinor: number;
  overdueReceivablesMinor: number;
  pendingApprovals: number;
  pendingApprovalValueMinor: number;
  cashflow: CashflowPoint[];
  categories: CategorySpend[];
  expensesByEmployee: Array<{ userId: string; name: string; amountMinor: number; count: number }>;
  recent: TransactionView[];
  aging: {
    receivables: Array<{ bucket: string; amountMinor: number; count: number }>;
    payables: Array<{ bucket: string; amountMinor: number; count: number }>;
  };
  policyFlags: number;
  rateAsOf: string;
}

export function getBusinessOverview(db: Database.Database, orgId: string): BusinessOverview {
  const accounts = listAccounts(db, "org", orgId);
  const cashUsdMinor = accounts.reduce(
    (acc, account) => acc + indicativeConvert(account.ledgerMinor, account.currency, "USD"),
    0,
  );
  const month = monthKey();
  const { start, end } = monthBounds(month);
  const flows = db
    .prepare(
      `SELECT a.currency, t.direction, SUM(t.amount_minor) AS total
       FROM transactions t JOIN accounts a ON a.id = t.account_id
       WHERE a.owner_type = 'org' AND a.owner_id = ? AND t.occurred_at >= ? AND t.occurred_at < ?
         AND t.status IN ('posted','processing')
       GROUP BY a.currency, t.direction`,
    )
    .all(orgId, start, end) as Array<{ currency: string; direction: string; total: number }>;
  const incomingMinor = flows
    .filter((f) => f.direction === "credit")
    .reduce((acc, f) => acc + indicativeConvert(f.total, f.currency, "USD"), 0);
  const outgoingMinor = flows
    .filter((f) => f.direction === "debit")
    .reduce((acc, f) => acc + indicativeConvert(f.total, f.currency, "USD"), 0);

  const receivables = db
    .prepare(
      `SELECT COALESCE(SUM(total_minor - amount_paid_minor), 0) AS due,
              COALESCE(SUM(CASE WHEN due_date < ? THEN total_minor - amount_paid_minor ELSE 0 END), 0) AS overdue
       FROM invoices WHERE org_id = ? AND status IN ('sent','partially_paid')`,
    )
    .get(new Date().toISOString(), orgId) as { due: number; overdue: number };
  const payables = db
    .prepare(
      `SELECT COALESCE(SUM(amount_minor), 0) AS due FROM bills
       WHERE org_id = ? AND status IN ('awaiting_approval','approved','scheduled','overdue')`,
    )
    .get(orgId) as { due: number };
  const approvals = db
    .prepare(
      `SELECT COUNT(*) AS count, COALESCE(SUM(amount_minor), 0) AS total FROM approval_requests
       WHERE org_id = ? AND status = 'pending'`,
    )
    .get(orgId) as { count: number; total: number };

  const employees = db
    .prepare(
      `SELECT e.user_id, u.name, SUM(e.amount_minor) AS total, COUNT(*) AS count
       FROM expenses e JOIN users u ON u.id = e.user_id
       WHERE e.org_id = ? AND e.status IN ('pending','approved','reimbursed')
       GROUP BY e.user_id ORDER BY total DESC`,
    )
    .all(orgId) as Array<{ user_id: string; name: string; total: number; count: number }>;

  const recent = listTransactions(db, "org", orgId, { limit: 8 }).rows;
  const categories = getSpendingByCategory(db, "org", orgId, "USD", start, end);
  const invoiceAging = db
    .prepare(
      `SELECT due_date, total_minor - amount_paid_minor AS due FROM invoices
       WHERE org_id = ? AND status IN ('sent','partially_paid')`,
    )
    .all(orgId) as Array<{ due_date: string; due: number }>;
  const billAging = db
    .prepare(
      `SELECT due_date, amount_minor AS due FROM bills
       WHERE org_id = ? AND status IN ('awaiting_approval','approved','scheduled','overdue')`,
    )
    .all(orgId) as Array<{ due_date: string; due: number }>;
  const policyRows = db
    .prepare("SELECT per_txn_limit_minor, categories FROM spending_policies WHERE org_id = ? AND active = 1")
    .all(orgId) as Array<{ per_txn_limit_minor: number; categories: string }>;
  const expenseRows = db
    .prepare("SELECT amount_minor, category FROM expenses WHERE org_id = ? AND status IN ('pending','approved')")
    .all(orgId) as Array<{ amount_minor: number; category: string }>;
  const policyFlags = expenseRows.filter((expense) =>
    policyRows.some(
      (policy) =>
        (JSON.parse(policy.categories) as string[]).includes(expense.category) &&
        expense.amount_minor > policy.per_txn_limit_minor,
    ),
  ).length;

  return {
    accounts,
    cashUsdMinor,
    incomingMinor,
    outgoingMinor,
    receivablesMinor: receivables.due,
    payablesMinor: payables.due,
    overdueReceivablesMinor: receivables.overdue,
    pendingApprovals: approvals.count,
    pendingApprovalValueMinor: approvals.total,
    cashflow: getCashflow(db, "org", orgId, "USD", 6),
    categories,
    expensesByEmployee: employees.map((e) => ({
      userId: e.user_id,
      name: e.name,
      amountMinor: e.total,
      count: e.count,
    })),
    recent,
    aging: {
      receivables: bucketAging(invoiceAging),
      payables: bucketAging(billAging),
    },
    policyFlags,
    rateAsOf: "2026-10-31T09:00:00.000Z",
  };
}

function bucketAging(rows: Array<{ due_date: string; due: number }>): Array<{ bucket: string; amountMinor: number; count: number }> {
  const buckets = [
    { bucket: "Current", amountMinor: 0, count: 0 },
    { bucket: "1–30 days", amountMinor: 0, count: 0 },
    { bucket: "31–60 days", amountMinor: 0, count: 0 },
    { bucket: "60+ days", amountMinor: 0, count: 0 },
  ];
  const now = Date.now();
  for (const row of rows) {
    const lateDays = Math.floor((now - new Date(row.due_date).getTime()) / 86_400_000);
    const index = lateDays <= 0 ? 0 : lateDays <= 30 ? 1 : lateDays <= 60 ? 2 : 3;
    buckets[index]!.amountMinor += row.due;
    buckets[index]!.count += 1;
  }
  return buckets;
}

export interface BusinessReports {
  cashflow: CashflowPoint[];
  categories: CategorySpend[];
  receivablesAging: Array<{ bucket: string; amountMinor: number; count: number }>;
  payablesAging: Array<{ bucket: string; amountMinor: number; count: number }>;
  vendorConcentration: Array<{ vendor: string; amountMinor: number; share: number }>;
  departmentSpend: Array<{ name: string; amountMinor: number; count: number }>;
  approvalStats: { pending: number; approved: number; rejected: number; averageHours: number };
  revenueMinor: number;
  expenseMinor: number;
  netMinor: number;
}

export function getBusinessReports(db: Database.Database, orgId: string): BusinessReports {
  const month = monthKey();
  const { start, end } = monthBounds(month);
  const cashflow = getCashflow(db, "org", orgId, "USD", 6);
  const current = cashflow[cashflow.length - 1];
  const categories = getSpendingByCategory(db, "org", orgId, "USD", start, end);
  const receivables = db
    .prepare(
      `SELECT due_date, total_minor - amount_paid_minor AS due FROM invoices
       WHERE org_id = ? AND status IN ('sent','partially_paid')`,
    )
    .all(orgId) as Array<{ due_date: string; due: number }>;
  const payables = db
    .prepare(
      `SELECT due_date, amount_minor AS due FROM bills
       WHERE org_id = ? AND status IN ('awaiting_approval','approved','scheduled','overdue')`,
    )
    .all(orgId) as Array<{ due_date: string; due: number }>;
  const vendors = db
    .prepare(
      `SELECT v.name, SUM(b.amount_minor) AS total FROM bills b JOIN vendors v ON v.id = b.vendor_id
       WHERE b.org_id = ? GROUP BY b.vendor_id ORDER BY total DESC`,
    )
    .all(orgId) as Array<{ name: string; total: number }>;
  const vendorTotal = vendors.reduce((acc, v) => acc + v.total, 0);
  const departments = db
    .prepare(
      `SELECT COALESCE(e.project, 'Unassigned') AS name, SUM(e.amount_minor) AS total, COUNT(*) AS count
       FROM expenses e WHERE e.org_id = ? AND e.status IN ('pending','approved','reimbursed')
       GROUP BY e.project ORDER BY total DESC`,
    )
    .all(orgId) as Array<{ name: string; total: number; count: number }>;
  const approvalStats = db
    .prepare(
      `SELECT status, COUNT(*) AS count FROM approval_requests WHERE org_id = ? GROUP BY status`,
    )
    .all(orgId) as Array<{ status: string; count: number }>;
  const decided = db
    .prepare(
      `SELECT created_at, decided_at FROM approval_requests WHERE org_id = ? AND decided_at IS NOT NULL`,
    )
    .all(orgId) as Array<{ created_at: string; decided_at: string }>;
  const averageHours =
    decided.length === 0
      ? 0
      : Math.round(
          (decided.reduce(
            (acc, row) =>
              acc + (new Date(row.decided_at).getTime() - new Date(row.created_at).getTime()) / 3_600_000,
            0,
          ) /
            decided.length) *
            10,
        ) / 10;

  return {
    cashflow,
    categories,
    receivablesAging: bucketAging(receivables),
    payablesAging: bucketAging(payables),
    vendorConcentration: vendors.map((v) => ({
      vendor: v.name,
      amountMinor: v.total,
      share: vendorTotal === 0 ? 0 : Math.round((v.total / vendorTotal) * 1000) / 10,
    })),
    departmentSpend: departments.map((d) => ({ name: d.name, amountMinor: d.total, count: d.count })),
    approvalStats: {
      pending: approvalStats.find((s) => s.status === "pending")?.count ?? 0,
      approved: approvalStats.find((s) => s.status === "approved")?.count ?? 0,
      rejected: approvalStats.find((s) => s.status === "rejected")?.count ?? 0,
      averageHours,
    },
    revenueMinor: current?.incomeMinor ?? 0,
    expenseMinor: current?.expenseMinor ?? 0,
    netMinor: current?.netMinor ?? 0,
  };
}

/* -------------------------------------------------------------------------- */
/* Invoices                                                                   */
/* -------------------------------------------------------------------------- */

export interface InvoiceListItem {
  id: string;
  number: string;
  customer: string;
  status: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  totalMinor: number;
  paidMinor: number;
  dueMinor: number;
  overdue: boolean;
}

export function listInvoices(db: Database.Database, orgId: string): InvoiceListItem[] {
  const rows = db
    .prepare(
      `SELECT i.id, i.number, c.name AS customer, i.status, i.issue_date, i.due_date, i.currency,
              i.total_minor, i.amount_paid_minor
       FROM invoices i JOIN customers c ON c.id = i.customer_id
       WHERE i.org_id = ? ORDER BY i.issue_date DESC`,
    )
    .all(orgId) as Array<{
    id: string;
    number: string;
    customer: string;
    status: string;
    issue_date: string;
    due_date: string;
    currency: string;
    total_minor: number;
    amount_paid_minor: number;
  }>;
  return rows.map((row) => ({
    id: row.id,
    number: row.number,
    customer: row.customer,
    status: row.status,
    issueDate: row.issue_date,
    dueDate: row.due_date,
    currency: row.currency,
    totalMinor: row.total_minor,
    paidMinor: row.amount_paid_minor,
    dueMinor: row.total_minor - row.amount_paid_minor,
    overdue: row.status !== "paid" && row.status !== "void" && new Date(row.due_date).getTime() < Date.now(),
  }));
}

export function getInvoice(db: Database.Database, orgId: string, invoiceId: string) {
  const invoice = db
    .prepare(
      `SELECT i.*, c.name AS customer_name, c.email AS customer_email, c.country AS customer_country
       FROM invoices i JOIN customers c ON c.id = i.customer_id
       WHERE i.id = ? AND i.org_id = ?`,
    )
    .get(invoiceId, orgId) as
    | {
        id: string;
        number: string;
        customer_name: string;
        customer_id: string;
        customer_email: string | null;
        customer_country: string;
        status: string;
        issue_date: string;
        due_date: string;
        currency: string;
        subtotal_minor: number;
        tax_minor: number;
        discount_minor: number;
        total_minor: number;
        amount_paid_minor: number;
        notes: string | null;
      }
    | undefined;
  if (!invoice) return null;
  const lines = db
    .prepare(
      "SELECT id, description, quantity_milli, unit_price_minor, amount_minor FROM invoice_lines WHERE invoice_id = ?",
    )
    .all(invoiceId) as Array<{
    id: string;
    description: string;
    quantity_milli: number;
    unit_price_minor: number;
    amount_minor: number;
  }>;
  return { invoice, lines };
}

export function createInvoice(
  db: Database.Database,
  actor: BusinessActor,
  input: {
    customerId: string;
    issueDate: string;
    dueDate: string;
    currency: string;
    taxBps: number;
    discountMinor: number;
    notes?: string;
    lines: Array<{ description: string; quantityMilli: number; unitPriceMinor: number }>;
  },
): string {
  assertBusinessPermission(actor.role, "invoice:write");
  if (input.lines.length === 0) throw new DomainError("VALIDATION_ERROR", "Add at least one line item");
  const customer = db
    .prepare("SELECT id FROM customers WHERE id = ? AND org_id = ?")
    .get(input.customerId, actor.orgId);
  if (!customer) throw new DomainError("NOT_FOUND", "Customer not found");

  const subtotal = input.lines.reduce((acc, line) => {
    if (line.quantityMilli <= 0 || line.unitPriceMinor < 0) {
      throw new DomainError("VALIDATION_ERROR", "Line quantities and prices must be valid");
    }
    return (
      acc +
      new Decimal(line.quantityMilli)
        .times(line.unitPriceMinor)
        .div(1000)
        .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
        .toNumber()
    );
  }, 0);
  const tax = new Decimal(subtotal)
    .times(input.taxBps)
    .div(10_000)
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
    .toNumber();
  const total = subtotal + tax - input.discountMinor;
  if (total <= 0) throw new DomainError("VALIDATION_ERROR", "Invoice total must be positive");

  return writeTransaction(db, () => {
    const year = new Date(input.issueDate).getUTCFullYear();
    const sequence =
      (db.prepare("SELECT COUNT(*) AS count FROM invoices WHERE org_id = ?").get(actor.orgId) as { count: number })
        .count + 1;
    const number = `INV-${year}-${String(sequence).padStart(3, "0")}`;
    const id = newId("inv");
    db.prepare(
      `INSERT INTO invoices
        (id, org_id, number, customer_id, status, issue_date, due_date, currency, subtotal_minor,
         tax_minor, discount_minor, total_minor, amount_paid_minor, notes, created_at)
       VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    ).run(
      id,
      actor.orgId,
      number,
      input.customerId,
      input.issueDate,
      input.dueDate,
      input.currency,
      subtotal,
      tax,
      input.discountMinor,
      total,
      input.notes ?? null,
      new Date().toISOString(),
    );
    const insertLine = db.prepare(
      `INSERT INTO invoice_lines (id, invoice_id, description, quantity_milli, unit_price_minor, amount_minor)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    for (const line of input.lines) {
      const amount = new Decimal(line.quantityMilli)
        .times(line.unitPriceMinor)
        .div(1000)
        .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
        .toNumber();
      insertLine.run(newId("invl"), id, line.description, line.quantityMilli, line.unitPriceMinor, amount);
    }
    recordAudit(db, {
      actorId: actor.user.id,
      actorRole: actor.role,
      action: "invoice.created",
      resourceType: "invoice",
      resourceId: id,
      orgId: actor.orgId,
      metadata: { number, total, currency: input.currency },
    });
    return id;
  });
}

export function sendInvoice(db: Database.Database, actor: BusinessActor, invoiceId: string): void {
  assertBusinessPermission(actor.role, "invoice:send");
  writeTransaction(db, () => {
    const invoice = db
      .prepare("SELECT id, number, status FROM invoices WHERE id = ? AND org_id = ?")
      .get(invoiceId, actor.orgId) as { id: string; number: string; status: string } | undefined;
    if (!invoice) throw new DomainError("NOT_FOUND", "Invoice not found");
    if (invoice.status !== "draft") throw new DomainError("CONFLICT", "Only draft invoices can be sent");
    db.prepare("UPDATE invoices SET status = 'sent' WHERE id = ?").run(invoiceId);
    recordAudit(db, {
      actorId: actor.user.id,
      actorRole: actor.role,
      action: "invoice.sent",
      resourceType: "invoice",
      resourceId: invoiceId,
      orgId: actor.orgId,
      metadata: { number: invoice.number },
    });
    webhook(db, "invoice.sent", { id: invoiceId, number: invoice.number });
  });
}

export function recordInvoicePayment(
  db: Database.Database,
  actor: BusinessActor,
  input: { invoiceId: string; accountId: string; amountMinor: number },
): void {
  assertBusinessPermission(actor.role, "invoice:write");
  const account = assertAccountAccess(db, actor.user, input.accountId, "account:transfer");
  if (account.owner_id !== actor.orgId) throw new DomainError("FORBIDDEN", "Account does not belong to this organization");
  if (input.amountMinor <= 0) throw new DomainError("VALIDATION_ERROR", "Payment must be positive");
  writeTransaction(db, () => {
    const invoice = db
      .prepare("SELECT id, number, status, total_minor, amount_paid_minor, currency FROM invoices WHERE id = ? AND org_id = ?")
      .get(input.invoiceId, actor.orgId) as
      | { id: string; number: string; status: string; total_minor: number; amount_paid_minor: number; currency: string }
      | undefined;
    if (!invoice) throw new DomainError("NOT_FOUND", "Invoice not found");
    if (!["sent", "partially_paid"].includes(invoice.status)) {
      throw new DomainError("CONFLICT", "This invoice is not open for payment");
    }
    if (account.currency !== invoice.currency) {
      throw new DomainError("VALIDATION_ERROR", "Payment account currency must match the invoice");
    }
    const due = invoice.total_minor - invoice.amount_paid_minor;
    if (input.amountMinor > due) throw new DomainError("VALIDATION_ERROR", "Payment exceeds the amount due");
    const journal = postJournal(db, {
      description: `Invoice payment — ${invoice.number}`,
      kind: "invoice",
      invoiceId: invoice.id,
      actorId: actor.user.id,
      postings: [
        { ledgerAccountId: `led_settlement_${invoice.currency}`, amountMinor: input.amountMinor },
        { ledgerAccountId: `led_${account.id}`, amountMinor: -input.amountMinor },
      ],
    });
    const paid = invoice.amount_paid_minor + input.amountMinor;
    db.prepare("UPDATE invoices SET amount_paid_minor = ?, status = ? WHERE id = ?").run(
      paid,
      paid >= invoice.total_minor ? "paid" : "partially_paid",
      invoice.id,
    );
    db.prepare(
      `INSERT INTO transactions
        (id, account_id, journal_id, transfer_id, card_id, direction, amount_minor, currency, status,
         category, merchant, description, counterparty, occurred_at, created_at)
       VALUES (?, ?, ?, NULL, NULL, 'credit', ?, ?, 'posted', 'Revenue', NULL, ?, 'Customer invoice', ?, ?)`,
    ).run(
      newId("txn"),
      account.id,
      journal.journalId,
      input.amountMinor,
      invoice.currency,
      `Invoice ${invoice.number} payment`,
      new Date().toISOString(),
      new Date().toISOString(),
    );
    recordAudit(db, {
      actorId: actor.user.id,
      actorRole: actor.role,
      action: "invoice.payment_recorded",
      resourceType: "invoice",
      resourceId: invoice.id,
      orgId: actor.orgId,
      metadata: { amount: input.amountMinor, journalId: journal.journalId },
    });
    webhook(db, "invoice.paid", { id: invoice.id, amount: input.amountMinor, status: paid >= invoice.total_minor ? "paid" : "partially_paid" });
  });
}

export function voidInvoice(db: Database.Database, actor: BusinessActor, invoiceId: string, reason: string): void {
  assertBusinessPermission(actor.role, "invoice:write");
  writeTransaction(db, () => {
    const invoice = db
      .prepare("SELECT id, status, notes FROM invoices WHERE id = ? AND org_id = ?")
      .get(invoiceId, actor.orgId) as { id: string; status: string; notes: string | null } | undefined;
    if (!invoice) throw new DomainError("NOT_FOUND", "Invoice not found");
    if (!["draft", "sent"].includes(invoice.status)) {
      throw new DomainError("CONFLICT", "Only unpaid draft or sent invoices can be voided");
    }
    db.prepare("UPDATE invoices SET status = 'void', notes = ? WHERE id = ?").run(
      `${invoice.notes ?? ""}\nVoided: ${reason}`.trim(),
      invoiceId,
    );
    recordAudit(db, {
      actorId: actor.user.id,
      actorRole: actor.role,
      action: "invoice.voided",
      resourceType: "invoice",
      resourceId: invoiceId,
      orgId: actor.orgId,
      metadata: { reason },
    });
  });
}

/* -------------------------------------------------------------------------- */
/* Bills and vendors                                                          */
/* -------------------------------------------------------------------------- */

export interface BillListItem {
  id: string;
  number: string;
  vendor: string;
  status: string;
  issueDate: string;
  dueDate: string;
  amountMinor: number;
  currency: string;
  category: string;
  description: string;
  overdue: boolean;
}

export function listBills(db: Database.Database, orgId: string): BillListItem[] {
  const rows = db
    .prepare(
      `SELECT b.id, b.number, v.name AS vendor, b.status, b.issue_date, b.due_date, b.amount_minor,
              b.currency, b.category, b.description
       FROM bills b JOIN vendors v ON v.id = b.vendor_id
       WHERE b.org_id = ? ORDER BY b.due_date ASC`,
    )
    .all(orgId) as Array<{
    id: string;
    number: string;
    vendor: string;
    status: string;
    issue_date: string;
    due_date: string;
    amount_minor: number;
    currency: string;
    category: string;
    description: string;
  }>;
  return rows.map((row) => ({
    id: row.id,
    number: row.number,
    vendor: row.vendor,
    status: row.status,
    issueDate: row.issue_date,
    dueDate: row.due_date,
    amountMinor: row.amount_minor,
    currency: row.currency,
    category: row.category,
    description: row.description,
    overdue: row.status !== "paid" && row.status !== "void" && new Date(row.due_date).getTime() < Date.now(),
  }));
}

export function listVendors(db: Database.Database, orgId: string) {
  return db
    .prepare(
      `SELECT v.id, v.name, v.email, v.category, v.currency, v.status,
              COUNT(b.id) AS bill_count, COALESCE(SUM(b.amount_minor), 0) AS total_minor
       FROM vendors v LEFT JOIN bills b ON b.vendor_id = v.id
       WHERE v.org_id = ? GROUP BY v.id ORDER BY v.name ASC`,
    )
    .all(orgId) as Array<{
    id: string;
    name: string;
    email: string | null;
    category: string;
    currency: string;
    status: string;
    bill_count: number;
    total_minor: number;
  }>;
}

export function createVendor(
  db: Database.Database,
  actor: BusinessActor,
  input: { name: string; email?: string; category: string; currency: string },
): string {
  assertBusinessPermission(actor.role, "bill:write");
  const id = newId("ven");
  writeTransaction(db, () => {
    db.prepare(
      `INSERT INTO vendors (id, org_id, name, email, category, currency, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'active', ?)`,
    ).run(id, actor.orgId, input.name, input.email ?? null, input.category, input.currency, new Date().toISOString());
    recordAudit(db, {
      actorId: actor.user.id,
      actorRole: actor.role,
      action: "vendor.created",
      resourceType: "vendor",
      resourceId: id,
      orgId: actor.orgId,
      metadata: { name: input.name },
    });
  });
  return id;
}

export function createBill(
  db: Database.Database,
  actor: BusinessActor,
  input: {
    vendorId: string;
    number: string;
    issueDate: string;
    dueDate: string;
    amountMinor: number;
    currency: string;
    category: string;
    description: string;
  },
): string {
  assertBusinessPermission(actor.role, "bill:write");
  if (input.amountMinor <= 0) throw new DomainError("VALIDATION_ERROR", "Bill amount must be positive");
  const vendor = db
    .prepare("SELECT id, name FROM vendors WHERE id = ? AND org_id = ?")
    .get(input.vendorId, actor.orgId) as { id: string; name: string } | undefined;
  if (!vendor) throw new DomainError("NOT_FOUND", "Vendor not found");
  return writeTransaction(db, () => {
    const id = newId("bil");
    db.prepare(
      `INSERT INTO bills
        (id, org_id, vendor_id, number, status, issue_date, due_date, currency, amount_minor, category, description, created_at)
       VALUES (?, ?, ?, ?, 'awaiting_approval', ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      actor.orgId,
      input.vendorId,
      input.number,
      input.issueDate,
      input.dueDate,
      input.currency,
      input.amountMinor,
      input.category,
      input.description,
      new Date().toISOString(),
    );
    createApproval(db, {
      orgId: actor.orgId,
      type: "bill",
      resourceId: id,
      title: `${vendor.name} — ${input.number}`,
      amountMinor: input.amountMinor,
      currency: input.currency,
      requestedBy: actor.user.id,
    });
    recordAudit(db, {
      actorId: actor.user.id,
      actorRole: actor.role,
      action: "bill.created",
      resourceType: "bill",
      resourceId: id,
      orgId: actor.orgId,
      metadata: { amount: input.amountMinor, vendor: vendor.name },
    });
    return id;
  });
}

export function payBill(
  db: Database.Database,
  actor: BusinessActor,
  input: { billId: string; accountId: string },
): void {
  assertBusinessPermission(actor.role, "bill:pay");
  const account = assertAccountAccess(db, actor.user, input.accountId, "account:transfer");
  if (account.owner_id !== actor.orgId) throw new DomainError("FORBIDDEN", "Account does not belong to this organization");
  writeTransaction(db, () => {
    const bill = db
      .prepare(
        `SELECT b.id, b.number, b.status, b.amount_minor, b.currency, b.category, b.description, v.name AS vendor
         FROM bills b JOIN vendors v ON v.id = b.vendor_id WHERE b.id = ? AND b.org_id = ?`,
      )
      .get(input.billId, actor.orgId) as
      | {
          id: string;
          number: string;
          status: string;
          amount_minor: number;
          currency: string;
          category: string;
          description: string;
          vendor: string;
        }
      | undefined;
    if (!bill) throw new DomainError("NOT_FOUND", "Bill not found");
    if (!["approved", "scheduled"].includes(bill.status)) {
      throw new DomainError("CONFLICT", "Only approved or scheduled bills can be paid");
    }
    if (account.currency !== bill.currency) {
      throw new DomainError("VALIDATION_ERROR", "Payment account currency must match the bill");
    }
    const balance = accountBalance(db, account.id);
    if (balance.availableMinor < bill.amount_minor) {
      throw new DomainError("INSUFFICIENT_FUNDS", "Available balance is insufficient for this bill");
    }
    const transferId = newId("trf");
    const journal = postJournal(db, {
      description: `Bill payment — ${bill.vendor} ${bill.number}`,
      kind: "transfer",
      transferId,
      actorId: actor.user.id,
      postings: [
        { ledgerAccountId: `led_${account.id}`, amountMinor: bill.amount_minor },
        { ledgerAccountId: `led_settlement_${bill.currency}`, amountMinor: -bill.amount_minor },
      ],
    });
    const providerRef = `prov_${newId("p").slice(2, 12)}`;
    db.prepare(
      `INSERT INTO transfers
        (id, reference, user_id, source_account_id, beneficiary_id, destination_account_id, direction, status,
         source_amount_minor, source_currency, target_amount_minor, target_currency, fee_minor, fee_currency,
         rate, quote_id, hold_id, journal_id, provider_ref, failure_reason, note, idempotency_key, created_at, updated_at, settled_at)
       VALUES (?, ?, ?, ?, NULL, NULL, 'external', 'posted', ?, ?, ?, ?, 0, ?, '1', NULL, NULL, ?, ?, NULL, ?, NULL, ?, ?, ?)`,
    ).run(
      transferId,
      reference("TRF"),
      actor.user.id,
      account.id,
      bill.amount_minor,
      bill.currency,
      bill.amount_minor,
      bill.currency,
      bill.currency,
      journal.journalId,
      providerRef,
      `Bill ${bill.number}`,
      new Date().toISOString(),
      new Date().toISOString(),
      new Date().toISOString(),
    );
    db.prepare(
      `INSERT INTO transactions
        (id, account_id, journal_id, transfer_id, card_id, direction, amount_minor, currency, status,
         category, merchant, description, counterparty, occurred_at, created_at)
       VALUES (?, ?, ?, ?, NULL, 'debit', ?, ?, 'posted', ?, ?, ?, ?, ?, ?)`,
    ).run(
      newId("txn"),
      account.id,
      journal.journalId,
      transferId,
      bill.amount_minor,
      bill.currency,
      bill.category,
      bill.vendor,
      `Bill payment — ${bill.number}`,
      bill.vendor,
      new Date().toISOString(),
      new Date().toISOString(),
    );
    db.prepare(
      `INSERT INTO provider_events (id, transfer_id, provider_ref, event_type, amount_minor, currency, status, created_at)
       VALUES (?, ?, ?, 'payout.settled', ?, ?, 'settled', ?)`,
    ).run(newId("pe"), transferId, providerRef, bill.amount_minor, bill.currency, new Date().toISOString());
    db.prepare("UPDATE bills SET status = 'paid' WHERE id = ?").run(bill.id);
    recordAudit(db, {
      actorId: actor.user.id,
      actorRole: actor.role,
      action: "bill.paid",
      resourceType: "bill",
      resourceId: bill.id,
      orgId: actor.orgId,
      metadata: { amount: bill.amount_minor, journalId: journal.journalId },
    });
    webhook(db, "bill.paid", { id: bill.id, amount: bill.amount_minor, journal_id: journal.journalId });
  });
}

/* -------------------------------------------------------------------------- */
/* Expenses                                                                   */
/* -------------------------------------------------------------------------- */

export interface ExpenseListItem {
  id: string;
  employee: string;
  userId: string;
  merchant: string;
  category: string;
  amountMinor: number;
  currency: string;
  status: string;
  project: string | null;
  receiptName: string | null;
  submittedAt: string;
  policyFlag: boolean;
}

export function listExpenses(db: Database.Database, orgId: string): ExpenseListItem[] {
  const rows = db
    .prepare(
      `SELECT e.id, u.name AS employee, e.user_id, e.merchant, e.category, e.amount_minor, e.currency,
              e.status, e.project, e.receipt_name, e.submitted_at
       FROM expenses e JOIN users u ON u.id = e.user_id
       WHERE e.org_id = ? ORDER BY e.submitted_at DESC`,
    )
    .all(orgId) as Array<{
    id: string;
    employee: string;
    user_id: string;
    merchant: string;
    category: string;
    amount_minor: number;
    currency: string;
    status: string;
    project: string | null;
    receipt_name: string | null;
    submitted_at: string;
  }>;
  const policies = db
    .prepare("SELECT per_txn_limit_minor, categories FROM spending_policies WHERE org_id = ? AND active = 1")
    .all(orgId) as Array<{ per_txn_limit_minor: number; categories: string }>;
  return rows.map((row) => {
    const policyFlag = policies.some(
      (p) => (JSON.parse(p.categories) as string[]).includes(row.category) && row.amount_minor > p.per_txn_limit_minor,
    );
    return {
      id: row.id,
      employee: row.employee,
      userId: row.user_id,
      merchant: row.merchant,
      category: row.category,
      amountMinor: row.amount_minor,
      currency: row.currency,
      status: row.status,
      project: row.project,
      receiptName: row.receipt_name,
      submittedAt: row.submitted_at,
      policyFlag,
    };
  });
}

export function submitExpense(
  db: Database.Database,
  actor: BusinessActor,
  input: {
    merchant: string;
    category: string;
    amountMinor: number;
    currency: string;
    project?: string;
    receiptName?: string;
  },
): string {
  assertBusinessPermission(actor.role, "expense:submit");
  if (input.amountMinor <= 0) throw new DomainError("VALIDATION_ERROR", "Expense amount must be positive");
  return writeTransaction(db, () => {
    const id = newId("exp");
    db.prepare(
      `INSERT INTO expenses
        (id, org_id, user_id, merchant, category, amount_minor, currency, status, project, receipt_name, submitted_at, decided_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, NULL, ?)`,
    ).run(
      id,
      actor.orgId,
      actor.user.id,
      input.merchant,
      input.category,
      input.amountMinor,
      input.currency,
      input.project ?? null,
      input.receiptName ?? null,
      new Date().toISOString(),
      new Date().toISOString(),
    );
    createApproval(db, {
      orgId: actor.orgId,
      type: "expense",
      resourceId: id,
      title: `${input.merchant} — ${actor.user.name}`,
      amountMinor: input.amountMinor,
      currency: input.currency,
      requestedBy: actor.user.id,
    });
    recordAudit(db, {
      actorId: actor.user.id,
      actorRole: actor.role,
      action: "expense.submitted",
      resourceType: "expense",
      resourceId: id,
      orgId: actor.orgId,
      metadata: { amount: input.amountMinor, category: input.category, receipt: Boolean(input.receiptName) },
    });
    return id;
  });
}

export function reimburseExpense(
  db: Database.Database,
  actor: BusinessActor,
  input: { expenseId: string; accountId: string },
): void {
  assertBusinessPermission(actor.role, "bill:pay");
  const account = assertAccountAccess(db, actor.user, input.accountId, "account:transfer");
  if (account.owner_id !== actor.orgId) throw new DomainError("FORBIDDEN", "Account does not belong to this organization");
  writeTransaction(db, () => {
    const expense = db
      .prepare("SELECT id, user_id, merchant, amount_minor, currency, status FROM expenses WHERE id = ? AND org_id = ?")
      .get(input.expenseId, actor.orgId) as
      | { id: string; user_id: string; merchant: string; amount_minor: number; currency: string; status: string }
      | undefined;
    if (!expense) throw new DomainError("NOT_FOUND", "Expense not found");
    if (expense.status !== "approved") throw new DomainError("CONFLICT", "Only approved expenses can be reimbursed");
    if (account.currency !== expense.currency) throw new DomainError("VALIDATION_ERROR", "Currency mismatch");
    const journal = postJournal(db, {
      description: `Expense reimbursement — ${expense.merchant}`,
      kind: "transfer",
      actorId: actor.user.id,
      postings: [
        { ledgerAccountId: `led_${account.id}`, amountMinor: expense.amount_minor },
        { ledgerAccountId: `led_settlement_${expense.currency}`, amountMinor: -expense.amount_minor },
      ],
    });
    db.prepare(
      `INSERT INTO transactions
        (id, account_id, journal_id, transfer_id, card_id, direction, amount_minor, currency, status,
         category, merchant, description, counterparty, occurred_at, created_at)
       VALUES (?, ?, ?, NULL, NULL, 'debit', ?, ?, 'posted', 'Reimbursement', ?, ?, 'Employee reimbursement', ?, ?)`,
    ).run(
      newId("txn"),
      account.id,
      journal.journalId,
      expense.amount_minor,
      expense.currency,
      expense.merchant,
      `Reimbursement — ${expense.merchant}`,
      new Date().toISOString(),
      new Date().toISOString(),
    );
    db.prepare("UPDATE expenses SET status = 'reimbursed' WHERE id = ?").run(expense.id);
    recordAudit(db, {
      actorId: actor.user.id,
      actorRole: actor.role,
      action: "expense.reimbursed",
      resourceType: "expense",
      resourceId: expense.id,
      orgId: actor.orgId,
      metadata: { amount: expense.amount_minor, journalId: journal.journalId },
    });
    notify(db, expense.user_id, "Expense reimbursed", `${expense.merchant} has been reimbursed.`, "expense", "/business/expenses");
  });
}

/* -------------------------------------------------------------------------- */
/* Approvals                                                                  */
/* -------------------------------------------------------------------------- */

function createApproval(
  db: Database.Database,
  input: {
    orgId: string;
    type: "expense" | "bill" | "invoice" | "payment";
    resourceId: string;
    title: string;
    amountMinor: number;
    currency: string;
    requestedBy: string;
  },
): string {
  const id = newId("apr");
  db.prepare(
    `INSERT INTO approval_requests
      (id, org_id, type, resource_id, title, amount_minor, currency, status, current_step, total_steps, requested_by, created_at, decided_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 1, 2, ?, ?, NULL)`,
  ).run(
    id,
    input.orgId,
    input.type,
    input.resourceId,
    input.title,
    input.amountMinor,
    input.currency,
    input.requestedBy,
    new Date().toISOString(),
  );
  db.prepare(
    `INSERT INTO approval_steps (id, request_id, step_no, role_required, status, decided_by, decided_at, comment)
     VALUES (?, ?, 1, 'approver', 'pending', NULL, NULL, NULL)`,
  ).run(newId("aps"), id);
  db.prepare(
    `INSERT INTO approval_steps (id, request_id, step_no, role_required, status, decided_by, decided_at, comment)
     VALUES (?, ?, 2, 'finance_manager', 'pending', NULL, NULL, NULL)`,
  ).run(newId("aps"), id);
  notify(db, input.requestedBy, "Approval submitted", `${input.title} is now waiting for review.`, "approval", "/business/approvals");
  return id;
}

export interface ApprovalListItem {
  id: string;
  type: string;
  title: string;
  amountMinor: number;
  currency: string;
  status: string;
  currentStep: number;
  totalSteps: number;
  requestedBy: string;
  requestedByName: string;
  createdAt: string;
  ageHours: number;
  resourceId: string;
  myTurn: boolean;
}

export function listApprovals(
  db: Database.Database,
  actor: BusinessActor,
  status?: string,
): ApprovalListItem[] {
  assertBusinessPermission(actor.role, "approval:read");
  const rows = db
    .prepare(
      `SELECT a.*, u.name AS requested_by_name,
              (SELECT role_required FROM approval_steps s WHERE s.request_id = a.id AND s.step_no = a.current_step) AS current_role
       FROM approval_requests a JOIN users u ON u.id = a.requested_by
       WHERE a.org_id = ? ${status ? "AND a.status = ?" : ""}
       ORDER BY a.created_at DESC`,
    )
    .all(...(status ? [actor.orgId, status] : [actor.orgId])) as Array<{
    id: string;
    type: string;
    title: string;
    amount_minor: number;
    currency: string;
    status: string;
    current_step: number;
    total_steps: number;
    requested_by: string;
    requested_by_name: string;
    created_at: string;
    resource_id: string;
    current_role: string | null;
  }>;
  return rows.map((row) => {
    const roleMatches =
      actor.role === row.current_role || (actor.role === "owner" && row.current_role === "finance_manager");
    return {
      id: row.id,
      type: row.type,
      title: row.title,
      amountMinor: row.amount_minor,
      currency: row.currency,
      status: row.status,
      currentStep: row.current_step,
      totalSteps: row.total_steps,
      requestedBy: row.requested_by,
      requestedByName: row.requested_by_name,
      createdAt: row.created_at,
      ageHours: Math.floor((Date.now() - new Date(row.created_at).getTime()) / 3_600_000),
      resourceId: row.resource_id,
      myTurn: row.status === "pending" && roleMatches && row.requested_by !== actor.user.id,
    };
  });
}

export function getApprovalDetail(db: Database.Database, orgId: string, approvalId: string) {
  const request = db
    .prepare(
      `SELECT a.*, u.name AS requested_by_name FROM approval_requests a
       JOIN users u ON u.id = a.requested_by WHERE a.id = ? AND a.org_id = ?`,
    )
    .get(approvalId, orgId) as
    | {
        id: string;
        type: string;
        resource_id: string;
        title: string;
        amount_minor: number;
        currency: string;
        status: string;
        current_step: number;
        total_steps: number;
        requested_by: string;
        requested_by_name: string;
        created_at: string;
        decided_at: string | null;
      }
    | undefined;
  if (!request) return null;
  const steps = db
    .prepare(
      `SELECT s.id, s.step_no, s.role_required, s.status, s.decided_by, s.decided_at, s.comment, u.name AS decided_by_name
       FROM approval_steps s LEFT JOIN users u ON u.id = s.decided_by
       WHERE s.request_id = ? ORDER BY s.step_no ASC`,
    )
    .all(approvalId) as Array<{
    id: string;
    step_no: number;
    role_required: string;
    status: string;
    decided_by: string | null;
    decided_at: string | null;
    comment: string | null;
    decided_by_name: string | null;
  }>;
  let resource: Record<string, unknown> | null = null;
  if (request.type === "expense") {
    resource =
      (db.prepare("SELECT * FROM expenses WHERE id = ?").get(request.resource_id) as
        | Record<string, unknown>
        | undefined) ?? null;
  } else if (request.type === "bill") {
    resource =
      (db.prepare("SELECT * FROM bills WHERE id = ?").get(request.resource_id) as
        | Record<string, unknown>
        | undefined) ?? null;
  }
  return { request, steps, resource };
}

export function decideApproval(
  db: Database.Database,
  actor: BusinessActor,
  input: { approvalId: string; decision: "approve" | "reject"; comment: string; pinVerified: boolean },
): void {
  assertBusinessPermission(actor.role, "approval:decide");
  if (!input.pinVerified) throw new DomainError("FORBIDDEN", "Step-up authorization is required");
  if (!input.comment.trim()) throw new DomainError("VALIDATION_ERROR", "Add a decision comment");
  writeTransaction(db, () => {
    const request = db
      .prepare("SELECT * FROM approval_requests WHERE id = ? AND org_id = ?")
      .get(input.approvalId, actor.orgId) as
      | {
          id: string;
          type: string;
          resource_id: string;
          title: string;
          amount_minor: number;
          currency: string;
          status: string;
          current_step: number;
          total_steps: number;
          requested_by: string;
        }
      | undefined;
    if (!request) throw new DomainError("NOT_FOUND", "Approval request not found");
    if (request.status !== "pending") throw new DomainError("CONFLICT", "This request is already decided");
    if (request.requested_by === actor.user.id) {
      throw new DomainError("FORBIDDEN", "Maker-checker: you cannot approve your own request");
    }
    const step = db
      .prepare("SELECT * FROM approval_steps WHERE request_id = ? AND step_no = ?")
      .get(request.id, request.current_step) as
      | { id: string; step_no: number; role_required: string; status: string }
      | undefined;
    if (!step) throw new DomainError("CONFLICT", "Approval step is missing");
    if (step.status !== "pending") throw new DomainError("CONFLICT", "This step is already decided");
    const roleMatches =
      actor.role === step.role_required || (actor.role === "owner" && step.role_required === "finance_manager");
    if (!roleMatches) throw new DomainError("FORBIDDEN", `This step requires the ${step.role_required} role`);

    const now = new Date().toISOString();
    if (input.decision === "reject") {
      db.prepare(
        "UPDATE approval_steps SET status = 'rejected', decided_by = ?, decided_at = ?, comment = ? WHERE id = ?",
      ).run(actor.user.id, now, input.comment, step.id);
      db.prepare("UPDATE approval_requests SET status = 'rejected', decided_at = ? WHERE id = ?").run(now, request.id);
      if (request.type === "expense") {
        db.prepare("UPDATE expenses SET status = 'rejected', decided_at = ? WHERE id = ?").run(now, request.resource_id);
      } else if (request.type === "bill") {
        db.prepare("UPDATE bills SET status = 'draft' WHERE id = ?").run(request.resource_id);
      }
      notify(db, request.requested_by, "Approval rejected", `${request.title}: ${input.comment}`, "approval", "/business/approvals");
    } else {
      db.prepare(
        "UPDATE approval_steps SET status = 'approved', decided_by = ?, decided_at = ?, comment = ? WHERE id = ?",
      ).run(actor.user.id, now, input.comment, step.id);
      if (request.current_step < request.total_steps) {
        db.prepare("UPDATE approval_requests SET current_step = current_step + 1 WHERE id = ?").run(request.id);
        notify(
          db,
          request.requested_by,
          "Approval progressed",
          `${request.title} passed step ${request.current_step} of ${request.total_steps}.`,
          "approval",
          "/business/approvals",
        );
      } else {
        db.prepare("UPDATE approval_requests SET status = 'approved', decided_at = ? WHERE id = ?").run(now, request.id);
        if (request.type === "expense") {
          db.prepare("UPDATE expenses SET status = 'approved', decided_at = ? WHERE id = ?").run(now, request.resource_id);
        } else if (request.type === "bill") {
          db.prepare("UPDATE bills SET status = 'approved' WHERE id = ?").run(request.resource_id);
        }
        notify(db, request.requested_by, "Approval complete", `${request.title} is fully approved.`, "approval", "/business/approvals");
      }
    }
    recordAudit(db, {
      actorId: actor.user.id,
      actorRole: actor.role,
      action: input.decision === "approve" ? "approval.step_approved" : "approval.rejected",
      resourceType: "approval_request",
      resourceId: request.id,
      orgId: actor.orgId,
      metadata: { step: request.current_step, comment: input.comment, type: request.type },
    });
    webhook(db, input.decision === "approve" ? "approval.approved" : "approval.rejected", {
      id: request.id,
      step: request.current_step,
      status: input.decision,
    });
  });
}

/* -------------------------------------------------------------------------- */
/* Team                                                                       */
/* -------------------------------------------------------------------------- */

export function listTeam(db: Database.Database, orgId: string) {
  return db
    .prepare(
      `SELECT m.id, m.role, m.status, m.created_at, u.id AS user_id, u.name, u.email, u.initials, u.kyc_status
       FROM memberships m JOIN users u ON u.id = m.user_id
       WHERE m.org_id = ? ORDER BY m.created_at ASC`,
    )
    .all(orgId) as Array<{
    id: string;
    role: string;
    status: string;
    created_at: string;
    user_id: string;
    name: string;
    email: string;
    initials: string;
    kyc_status: string;
  }>;
}

export function updateMemberRole(
  db: Database.Database,
  actor: BusinessActor,
  input: { membershipId: string; role: BusinessRole },
): void {
  if (actor.role !== "owner") throw new DomainError("FORBIDDEN", "Only the organization owner can change roles");
  writeTransaction(db, () => {
    const membership = db
      .prepare("SELECT id, user_id, role FROM memberships WHERE id = ? AND org_id = ?")
      .get(input.membershipId, actor.orgId) as { id: string; user_id: string; role: string } | undefined;
    if (!membership) throw new DomainError("NOT_FOUND", "Membership not found");
    if (membership.role === "owner" && input.role !== "owner") {
      const owners = db
        .prepare("SELECT COUNT(*) AS count FROM memberships WHERE org_id = ? AND role = 'owner' AND status = 'active'")
        .get(actor.orgId) as { count: number };
      if (owners.count <= 1) throw new DomainError("CONFLICT", "An organization must retain at least one owner");
    }
    db.prepare("UPDATE memberships SET role = ? WHERE id = ?").run(input.role, membership.id);
    recordAudit(db, {
      actorId: actor.user.id,
      actorRole: actor.role,
      action: "team.role_changed",
      resourceType: "membership",
      resourceId: membership.id,
      orgId: actor.orgId,
      metadata: { from: membership.role, to: input.role, subject: membership.user_id },
    });
  });
}
