import type Database from "better-sqlite3";
import { getDb } from "@/db/client";
import { accountBalance } from "@/domain/ledger";
import { indicativeConvert, SANDBOX_RATE_SNAPSHOT } from "@/domain/fx";
import { monthKey } from "@/lib/utils";

export interface AccountView {
  id: string;
  name: string;
  kind: string;
  currency: string;
  country: string;
  iban: string | null;
  masked: string | null;
  status: string;
  isPrimary: boolean;
  ledgerMinor: number;
  heldMinor: number;
  availableMinor: number;
}

export function listAccounts(
  db: Database.Database,
  ownerType: "user" | "org",
  ownerId: string,
): AccountView[] {
  const rows = db
    .prepare(
      `SELECT id, name, kind, currency, country, iban, account_number_masked, status, is_primary
       FROM accounts WHERE owner_type = ? AND owner_id = ? ORDER BY is_primary DESC, created_at ASC`,
    )
    .all(ownerType, ownerId) as Array<{
    id: string;
    name: string;
    kind: string;
    currency: string;
    country: string;
    iban: string | null;
    account_number_masked: string | null;
    status: string;
    is_primary: number;
  }>;

  return rows.map((row) => {
    const balance = accountBalance(db, row.id);
    return {
      id: row.id,
      name: row.name,
      kind: row.kind,
      currency: row.currency,
      country: row.country,
      iban: row.iban,
      masked: row.account_number_masked,
      status: row.status,
      isPrimary: row.is_primary === 1,
      ledgerMinor: balance.ledgerMinor,
      heldMinor: balance.heldMinor,
      availableMinor: balance.availableMinor,
    };
  });
}

export interface Portfolio {
  accounts: AccountView[];
  totalUsdMinor: number;
  rateAsOf: string;
  rateSource: string;
  disclosure: string;
}

export function getPortfolio(
  db: Database.Database,
  ownerType: "user" | "org",
  ownerId: string,
): Portfolio {
  const accounts = listAccounts(db, ownerType, ownerId);
  const totalUsdMinor = accounts.reduce(
    (acc, account) => acc + indicativeConvert(account.ledgerMinor, account.currency, "USD"),
    0,
  );
  return {
    accounts,
    totalUsdMinor,
    rateAsOf: SANDBOX_RATE_SNAPSHOT.asOf,
    rateSource: SANDBOX_RATE_SNAPSHOT.source,
    disclosure:
      "Indicative USD equivalent using synthetic sandbox rates. Not a settlement quote or guaranteed value.",
  };
}

export interface TransactionView {
  id: string;
  accountId: string;
  accountName: string;
  accountCurrency: string;
  direction: "credit" | "debit";
  amountMinor: number;
  currency: string;
  status: string;
  category: string;
  merchant: string | null;
  description: string;
  counterparty: string | null;
  occurredAt: string;
  transferId: string | null;
  journalId: string | null;
  cardLast4: string | null;
}

export interface TransactionFilters {
  accountId?: string;
  search?: string;
  category?: string;
  direction?: "credit" | "debit";
  status?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export function listTransactions(
  db: Database.Database,
  ownerType: "user" | "org",
  ownerId: string,
  filters: TransactionFilters = {},
): { rows: TransactionView[]; total: number } {
  const clauses = ["a.owner_type = ?", "a.owner_id = ?"];
  const params: Array<string | number> = [ownerType, ownerId];
  if (filters.accountId) {
    clauses.push("t.account_id = ?");
    params.push(filters.accountId);
  }
  if (filters.search) {
    clauses.push("(t.description LIKE ? OR t.merchant LIKE ? OR t.counterparty LIKE ?)");
    const like = `%${filters.search}%`;
    params.push(like, like, like);
  }
  if (filters.category) {
    clauses.push("t.category = ?");
    params.push(filters.category);
  }
  if (filters.direction) {
    clauses.push("t.direction = ?");
    params.push(filters.direction);
  }
  if (filters.status) {
    clauses.push("t.status = ?");
    params.push(filters.status);
  }
  if (filters.from) {
    clauses.push("t.occurred_at >= ?");
    params.push(filters.from);
  }
  if (filters.to) {
    clauses.push("t.occurred_at <= ?");
    params.push(filters.to);
  }
  const where = clauses.join(" AND ");
  const total = db
    .prepare(`SELECT COUNT(*) AS count FROM transactions t JOIN accounts a ON a.id = t.account_id WHERE ${where}`)
    .get(...params) as { count: number };
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
  const offset = Math.max(filters.offset ?? 0, 0);
  const rows = db
    .prepare(
      `SELECT t.id, t.account_id, a.name AS account_name, a.currency AS account_currency,
              t.direction, t.amount_minor, t.currency, t.status, t.category, t.merchant,
              t.description, t.counterparty, t.occurred_at, t.transfer_id, t.journal_id,
              c.last4 AS card_last4
       FROM transactions t
       JOIN accounts a ON a.id = t.account_id
       LEFT JOIN cards c ON c.id = t.card_id
       WHERE ${where}
       ORDER BY t.occurred_at DESC, t.created_at DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...params, limit, offset) as Array<{
    id: string;
    account_id: string;
    account_name: string;
    account_currency: string;
    direction: "credit" | "debit";
    amount_minor: number;
    currency: string;
    status: string;
    category: string;
    merchant: string | null;
    description: string;
    counterparty: string | null;
    occurred_at: string;
    transfer_id: string | null;
    journal_id: string | null;
    card_last4: string | null;
  }>;

  return {
    rows: rows.map((row) => ({
      id: row.id,
      accountId: row.account_id,
      accountName: row.account_name,
      accountCurrency: row.account_currency,
      direction: row.direction,
      amountMinor: row.amount_minor,
      currency: row.currency,
      status: row.status,
      category: row.category,
      merchant: row.merchant,
      description: row.description,
      counterparty: row.counterparty,
      occurredAt: row.occurred_at,
      transferId: row.transfer_id,
      journalId: row.journal_id,
      cardLast4: row.card_last4,
    })),
    total: total.count,
  };
}

export function getTransaction(
  db: Database.Database,
  ownerType: "user" | "org",
  ownerId: string,
  transactionId: string,
): TransactionView | null {
  const row = db
    .prepare(
      `SELECT t.id, t.account_id, a.name AS account_name, a.currency AS account_currency,
              t.direction, t.amount_minor, t.currency, t.status, t.category, t.merchant,
              t.description, t.counterparty, t.occurred_at, t.transfer_id, t.journal_id,
              c.last4 AS card_last4
       FROM transactions t
       JOIN accounts a ON a.id = t.account_id
       LEFT JOIN cards c ON c.id = t.card_id
       WHERE t.id = ? AND a.owner_type = ? AND a.owner_id = ?`,
    )
    .get(transactionId, ownerType, ownerId) as
    | {
        id: string;
        account_id: string;
        account_name: string;
        account_currency: string;
        direction: "credit" | "debit";
        amount_minor: number;
        currency: string;
        status: string;
        category: string;
        merchant: string | null;
        description: string;
        counterparty: string | null;
        occurred_at: string;
        transfer_id: string | null;
        journal_id: string | null;
        card_last4: string | null;
      }
    | undefined;
  if (!row) return null;
  return {
    id: row.id,
    accountId: row.account_id,
    accountName: row.account_name,
    accountCurrency: row.account_currency,
    direction: row.direction,
    amountMinor: row.amount_minor,
    currency: row.currency,
    status: row.status,
    category: row.category,
    merchant: row.merchant,
    description: row.description,
    counterparty: row.counterparty,
    occurredAt: row.occurred_at,
    transferId: row.transfer_id,
    journalId: row.journal_id,
    cardLast4: row.card_last4,
  };
}

export function monthBounds(month: string): { start: string; end: string; nextMonth: string } {
  const [year, monthNumber] = month.split("-").map(Number);
  const start = new Date(Date.UTC(year ?? 2026, (monthNumber ?? 1) - 1, 1));
  const end = new Date(Date.UTC(year ?? 2026, monthNumber ?? 1, 1));
  const next = new Date(Date.UTC(year ?? 2026, monthNumber ?? 1, 1));
  return {
    start: start.toISOString(),
    end: end.toISOString(),
    nextMonth: `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`,
  };
}

export interface CashflowPoint {
  month: string;
  label: string;
  incomeMinor: number;
  expenseMinor: number;
  netMinor: number;
}

export function getCashflow(
  db: Database.Database,
  ownerType: "user" | "org",
  ownerId: string,
  currency: string,
  months = 6,
): CashflowPoint[] {
  const points: CashflowPoint[] = [];
  const cursor = new Date();
  cursor.setUTCDate(1);
  cursor.setUTCHours(0, 0, 0, 0);
  for (let i = months - 1; i >= 0; i -= 1) {
    const date = new Date(cursor);
    date.setUTCMonth(date.getUTCMonth() - i);
    const key = monthKey(date);
    const { start, end } = monthBounds(key);
    const rows = db
      .prepare(
        `SELECT t.direction, COALESCE(SUM(t.amount_minor), 0) AS total
         FROM transactions t JOIN accounts a ON a.id = t.account_id
         WHERE a.owner_type = ? AND a.owner_id = ? AND a.currency = ?
           AND t.occurred_at >= ? AND t.occurred_at < ?
           AND t.status IN ('posted','processing')
         GROUP BY t.direction`,
      )
      .all(ownerType, ownerId, currency, start, end) as Array<{ direction: string; total: number }>;
    const income = rows.find((r) => r.direction === "credit")?.total ?? 0;
    const expense = rows.find((r) => r.direction === "debit")?.total ?? 0;
    points.push({
      month: key,
      label: new Intl.DateTimeFormat("en-GB", { month: "short" }).format(date),
      incomeMinor: income,
      expenseMinor: expense,
      netMinor: income - expense,
    });
  }
  return points;
}

export interface CategorySpend {
  category: string;
  amountMinor: number;
  share: number;
  count: number;
}

export function getSpendingByCategory(
  db: Database.Database,
  ownerType: "user" | "org",
  ownerId: string,
  currency: string,
  from: string,
  to: string,
): CategorySpend[] {
  const rows = db
    .prepare(
      `SELECT t.category, SUM(t.amount_minor) AS total, COUNT(*) AS count
       FROM transactions t JOIN accounts a ON a.id = t.account_id
       WHERE a.owner_type = ? AND a.owner_id = ? AND a.currency = ? AND t.direction = 'debit'
         AND t.occurred_at >= ? AND t.occurred_at <= ? AND t.status IN ('posted','processing')
       GROUP BY t.category ORDER BY total DESC`,
    )
    .all(ownerType, ownerId, currency, from, to) as Array<{
    category: string;
    total: number;
    count: number;
  }>;
  const sum = rows.reduce((acc, row) => acc + row.total, 0);
  return rows.map((row) => ({
    category: row.category,
    amountMinor: row.total,
    share: sum === 0 ? 0 : Math.round((row.total / sum) * 1000) / 10,
    count: row.count,
  }));
}

export interface BudgetView {
  id: string;
  month: string;
  totalLimitMinor: number;
  currency: string;
  categories: Array<{
    id: string;
    category: string;
    limitMinor: number;
    spentMinor: number;
    utilization: number;
  }>;
  spentMinor: number;
  utilization: number;
}

export function getBudget(
  db: Database.Database,
  userId: string,
  month: string,
): BudgetView | null {
  const budget = db
    .prepare("SELECT id, month, total_limit_minor, currency FROM budgets WHERE user_id = ? AND month = ?")
    .get(userId, month) as
    | { id: string; month: string; total_limit_minor: number; currency: string }
    | undefined;
  if (!budget) return null;
  const categories = db
    .prepare("SELECT id, category, limit_minor FROM budget_categories WHERE budget_id = ? ORDER BY limit_minor DESC")
    .all(budget.id) as Array<{ id: string; category: string; limit_minor: number }>;
  const { start, end } = monthBounds(month);
  const spendRows = db
    .prepare(
      `SELECT t.category, SUM(t.amount_minor) AS total
       FROM transactions t JOIN accounts a ON a.id = t.account_id
       WHERE a.owner_type = 'user' AND a.owner_id = ? AND a.currency = ? AND t.direction = 'debit'
         AND t.occurred_at >= ? AND t.occurred_at < ? AND t.status IN ('posted','processing')
       GROUP BY t.category`,
    )
    .all(userId, budget.currency, start, end) as Array<{ category: string; total: number }>;
  const spendMap = new Map(spendRows.map((row) => [row.category, row.total]));
  const mapped = categories.map((row) => {
    const spent = spendMap.get(row.category) ?? 0;
    return {
      id: row.id,
      category: row.category,
      limitMinor: row.limit_minor,
      spentMinor: spent,
      utilization: row.limit_minor === 0 ? 0 : Math.round((spent / row.limit_minor) * 100),
    };
  });
  const spentMinor = mapped.reduce((acc, row) => acc + row.spentMinor, 0);
  return {
    id: budget.id,
    month: budget.month,
    totalLimitMinor: budget.total_limit_minor,
    currency: budget.currency,
    categories: mapped,
    spentMinor,
    utilization: Math.round((spentMinor / budget.total_limit_minor) * 100),
  };
}

export interface GoalView {
  id: string;
  name: string;
  targetMinor: number;
  currency: string;
  targetDate: string;
  accountId: string;
  accountName: string;
  currentMinor: number;
  progress: number;
  status: string;
  contributions: Array<{ amountMinor: number; createdAt: string }>;
}

export function getGoals(db: Database.Database, userId: string): GoalView[] {
  const goals = db
    .prepare(
      `SELECT g.id, g.name, g.target_minor, g.currency, g.target_date, g.account_id, g.status,
              a.name AS account_name
       FROM goals g JOIN accounts a ON a.id = g.account_id
       WHERE g.user_id = ? ORDER BY g.created_at ASC`,
    )
    .all(userId) as Array<{
    id: string;
    name: string;
    target_minor: number;
    currency: string;
    target_date: string;
    account_id: string;
    status: string;
    account_name: string;
  }>;
  return goals.map((goal) => {
    const balance = accountBalance(db, goal.account_id);
    const contributions = db
      .prepare(
        "SELECT amount_minor, created_at FROM goal_contributions WHERE goal_id = ? ORDER BY created_at DESC LIMIT 12",
      )
      .all(goal.id) as Array<{ amount_minor: number; created_at: string }>;
    return {
      id: goal.id,
      name: goal.name,
      targetMinor: goal.target_minor,
      currency: goal.currency,
      targetDate: goal.target_date,
      accountId: goal.account_id,
      accountName: goal.account_name,
      currentMinor: balance.ledgerMinor,
      progress: Math.min(100, Math.round((balance.ledgerMinor / goal.target_minor) * 100)),
      status: goal.status,
      contributions: contributions.map((c) => ({ amountMinor: c.amount_minor, createdAt: c.created_at })),
    };
  });
}

export interface CardView {
  id: string;
  label: string;
  last4: string;
  network: string;
  kind: string;
  status: string;
  monthlyLimitMinor: number;
  perTxnLimitMinor: number;
  currency: string;
  allowedCategories: string[];
  accountId: string;
  accountName: string;
  spentThisMonthMinor: number;
  frozenAt: string | null;
  recent: TransactionView[];
}

export function getCards(
  db: Database.Database,
  ownerType: "user" | "org",
  ownerId: string,
): CardView[] {
  const cards = db
    .prepare(
      `SELECT c.*, a.name AS account_name FROM cards c JOIN accounts a ON a.id = c.account_id
       WHERE c.owner_type = ? AND c.owner_id = ? ORDER BY c.created_at ASC`,
    )
    .all(ownerType, ownerId) as Array<{
    id: string;
    label: string;
    last4: string;
    network: string;
    kind: string;
    status: string;
    monthly_limit_minor: number;
    per_txn_limit_minor: number;
    currency: string;
    allowed_categories: string;
    account_id: string;
    account_name: string;
    frozen_at: string | null;
  }>;
  const { start, end } = monthBounds(monthKey());
  return cards.map((card) => {
    const spent = db
      .prepare(
        `SELECT COALESCE(SUM(amount_minor), 0) AS total FROM transactions
         WHERE card_id = ? AND direction = 'debit' AND occurred_at >= ? AND occurred_at < ? AND status = 'posted'`,
      )
      .get(card.id, start, end) as { total: number };
    const recent = db
      .prepare(
        `SELECT t.id, t.account_id, a.name AS account_name, a.currency AS account_currency,
                t.direction, t.amount_minor, t.currency, t.status, t.category, t.merchant,
                t.description, t.counterparty, t.occurred_at, t.transfer_id, t.journal_id, c.last4 AS card_last4
         FROM transactions t JOIN accounts a ON a.id = t.account_id LEFT JOIN cards c ON c.id = t.card_id
         WHERE t.card_id = ? ORDER BY t.occurred_at DESC LIMIT 6`,
      )
      .all(card.id) as Array<{
      id: string;
      account_id: string;
      account_name: string;
      account_currency: string;
      direction: "credit" | "debit";
      amount_minor: number;
      currency: string;
      status: string;
      category: string;
      merchant: string | null;
      description: string;
      counterparty: string | null;
      occurred_at: string;
      transfer_id: string | null;
      journal_id: string | null;
      card_last4: string | null;
    }>;
    return {
      id: card.id,
      label: card.label,
      last4: card.last4,
      network: card.network,
      kind: card.kind,
      status: card.status,
      monthlyLimitMinor: card.monthly_limit_minor,
      perTxnLimitMinor: card.per_txn_limit_minor,
      currency: card.currency,
      allowedCategories: JSON.parse(card.allowed_categories) as string[],
      accountId: card.account_id,
      accountName: card.account_name,
      spentThisMonthMinor: spent.total,
      frozenAt: card.frozen_at,
      recent: recent.map((row) => ({
        id: row.id,
        accountId: row.account_id,
        accountName: row.account_name,
        accountCurrency: row.account_currency,
        direction: row.direction,
        amountMinor: row.amount_minor,
        currency: row.currency,
        status: row.status,
        category: row.category,
        merchant: row.merchant,
        description: row.description,
        counterparty: row.counterparty,
        occurredAt: row.occurred_at,
        transferId: row.transfer_id,
        journalId: row.journal_id,
        cardLast4: row.card_last4,
      })),
    };
  });
}

export interface RecurringItem {
  merchant: string;
  category: string;
  averageMinor: number;
  currency: string;
  lastDate: string;
  nextDate: string;
  occurrences: number;
}

export function getRecurring(
  db: Database.Database,
  ownerType: "user" | "org",
  ownerId: string,
  currency: string,
): RecurringItem[] {
  const since = new Date(Date.now() - 120 * 86_400_000).toISOString();
  const rows = db
    .prepare(
      `SELECT t.merchant, t.category, AVG(t.amount_minor) AS avg_minor, MAX(t.occurred_at) AS last_date,
              COUNT(*) AS occurrences
       FROM transactions t JOIN accounts a ON a.id = t.account_id
       WHERE a.owner_type = ? AND a.owner_id = ? AND a.currency = ? AND t.direction = 'debit'
         AND t.merchant IS NOT NULL AND t.occurred_at >= ? AND t.status = 'posted'
       GROUP BY t.merchant, t.category
       HAVING COUNT(*) >= 2
       ORDER BY avg_minor DESC`,
    )
    .all(ownerType, ownerId, currency, since) as Array<{
    merchant: string;
    category: string;
    avg_minor: number;
    last_date: string;
    occurrences: number;
  }>;
  return rows.map((row) => {
    const next = new Date(row.last_date);
    next.setUTCDate(next.getUTCDate() + 30);
    return {
      merchant: row.merchant,
      category: row.category,
      averageMinor: Math.round(row.avg_minor),
      currency,
      lastDate: row.last_date,
      nextDate: next.toISOString(),
      occurrences: row.occurrences,
    };
  });
}

export interface MerchantInsight {
  merchant: string;
  amountMinor: number;
  count: number;
}

export function getTopMerchants(
  db: Database.Database,
  ownerType: "user" | "org",
  ownerId: string,
  currency: string,
  from: string,
  to: string,
  limit = 6,
): MerchantInsight[] {
  return (
    db
      .prepare(
        `SELECT t.merchant, SUM(t.amount_minor) AS total, COUNT(*) AS count
         FROM transactions t JOIN accounts a ON a.id = t.account_id
         WHERE a.owner_type = ? AND a.owner_id = ? AND a.currency = ? AND t.direction = 'debit'
           AND t.merchant IS NOT NULL AND t.occurred_at >= ? AND t.occurred_at <= ?
         GROUP BY t.merchant ORDER BY total DESC LIMIT ?`,
      )
      .all(ownerType, ownerId, currency, from, to, limit) as Array<{
      merchant: string;
      total: number;
      count: number;
    }>
  ).map((row) => ({ merchant: row.merchant, amountMinor: row.total, count: row.count }));
}

export interface PersonalDashboard {
  portfolio: Portfolio;
  currency: string;
  month: string;
  incomeMinor: number;
  expenseMinor: number;
  savingsRate: number;
  cashflow: CashflowPoint[];
  categories: CategorySpend[];
  budget: BudgetView | null;
  goals: GoalView[];
  recent: TransactionView[];
  recurring: RecurringItem[];
  topMerchants: MerchantInsight[];
  heldMinor: number;
  availableUsdMinor: number;
}

export function getPersonalDashboard(db: Database.Database, userId: string): PersonalDashboard {
  const portfolio = getPortfolio(db, "user", userId);
  const primary = portfolio.accounts.find((a) => a.isPrimary) ?? portfolio.accounts[0];
  const currency = primary?.currency ?? "USD";
  const month = monthKey();
  const { start, end } = monthBounds(month);
  const flow = db
    .prepare(
      `SELECT t.direction, COALESCE(SUM(t.amount_minor), 0) AS total
       FROM transactions t JOIN accounts a ON a.id = t.account_id
       WHERE a.owner_type = 'user' AND a.owner_id = ? AND a.currency = ?
         AND t.occurred_at >= ? AND t.occurred_at < ? AND t.status IN ('posted','processing')
       GROUP BY t.direction`,
    )
    .all(userId, currency, start, end) as Array<{ direction: string; total: number }>;
  const incomeMinor = flow.find((f) => f.direction === "credit")?.total ?? 0;
  const expenseMinor = flow.find((f) => f.direction === "debit")?.total ?? 0;
  const recent = listTransactions(db, "user", userId, { limit: 8 }).rows;
  const heldMinor = portfolio.accounts.reduce((acc, account) => acc + account.heldMinor, 0);
  const availableUsdMinor = portfolio.accounts.reduce(
    (acc, account) => acc + indicativeConvert(account.availableMinor, account.currency, "USD"),
    0,
  );
  return {
    portfolio,
    currency,
    month,
    incomeMinor,
    expenseMinor,
    savingsRate: incomeMinor === 0 ? 0 : Math.round(((incomeMinor - expenseMinor) / incomeMinor) * 100),
    cashflow: getCashflow(db, "user", userId, currency, 6),
    categories: getSpendingByCategory(db, "user", userId, currency, start, end),
    budget: getBudget(db, userId, month),
    goals: getGoals(db, userId),
    recent,
    recurring: getRecurring(db, "user", userId, currency).slice(0, 5),
    topMerchants: getTopMerchants(db, "user", userId, currency, start, end),
    heldMinor,
    availableUsdMinor,
  };
}

export function getDbOrThrow() {
  return getDb();
}
