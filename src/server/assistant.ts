import type Database from "better-sqlite3";
import type { SessionUser } from "@/domain/identity";
import { formatMoney } from "@/domain/money";
import { getPersonalDashboard, getBudget, getGoals, getRecurring, monthBounds, listTransactions } from "./finance";
import { listTransfers, getTransferDetail } from "./transfers";
import { monthKey } from "@/lib/utils";

export interface AssistantAnswer {
  intent: string;
  answer: string;
  citations: Array<{ label: string; value: string; href?: string }>;
  disclaimer: string;
}

export const SUGGESTED_PROMPTS = [
  "How much did I spend this month?",
  "Where is my money going?",
  "How is my budget doing?",
  "What subscriptions renew soon?",
  "How are my savings goals tracking?",
  "What is the status of my last transfer?",
  "How does the FX fee work?",
];

const DISCLAIMER =
  "Grounded in your sandbox records. Atlas Assistant cannot move money, approve requests, change limits, or guarantee outcomes.";

export function askAtlas(db: Database.Database, user: SessionUser, question: string): AssistantAnswer {
  const q = question.trim().toLowerCase();
  const dashboard = getPersonalDashboard(db, user.id);
  const currency = dashboard.currency;

  if (/(balance|net worth|how much do i have)/.test(q)) {
    const accounts = dashboard.portfolio.accounts;
    const lines = accounts
      .map((account) => `${account.name}: ${formatMoney(account.ledgerMinor, account.currency)}`)
      .join("\n");
    return {
      intent: "balances",
      answer: `Across ${accounts.length} sandbox accounts you hold:\n${lines}\n\nIndicative USD equivalent: ${formatMoney(
        dashboard.portfolio.totalUsdMinor,
        "USD",
      )}.\nAvailable after holds: ${formatMoney(dashboard.availableUsdMinor, "USD")} equivalent.\n\n${dashboard.portfolio.disclosure}`,
      citations: accounts.map((account) => ({
        label: account.name,
        value: formatMoney(account.ledgerMinor, account.currency),
        href: `/app/accounts/${account.id}`,
      })),
      disclaimer: DISCLAIMER,
    };
  }

  if (/(spend|spent|expense|where.*money|category)/.test(q)) {
    const top = dashboard.categories.slice(0, 4);
    const lines = top
      .map((category) => `${category.category}: ${formatMoney(category.amountMinor, currency)} (${category.share}%)`)
      .join("\n");
    const total = dashboard.categories.reduce((acc, category) => acc + category.amountMinor, 0);
    return {
      intent: "spending",
      answer: `This month you have spent ${formatMoney(total, currency)} across ${
        dashboard.categories.length
      } categories.\n\n${lines || "No spending recorded yet."}\n\nLargest category: ${
        top[0]?.category ?? "none"
      }. Income for the month is ${formatMoney(dashboard.incomeMinor, currency)}.`,
      citations: top.map((category) => ({
        label: category.category,
        value: formatMoney(category.amountMinor, currency),
        href: `/app/insights?category=${encodeURIComponent(category.category)}`,
      })),
      disclaimer: DISCLAIMER,
    };
  }

  if (/(budget|overspend)/.test(q)) {
    const budget = getBudget(db, user.id, monthKey());
    if (!budget) {
      return {
        intent: "budget",
        answer: "You do not have a budget for this month yet. Create one from Budgets to track category limits.",
        citations: [],
        disclaimer: DISCLAIMER,
      };
    }
    const over = budget.categories.filter((c) => c.utilization > 100);
    const near = budget.categories.filter((c) => c.utilization >= 80 && c.utilization <= 100);
    return {
      intent: "budget",
      answer: `You have used ${formatMoney(budget.spentMinor, budget.currency)} of your ${formatMoney(
        budget.totalLimitMinor,
        budget.currency,
      )} monthly budget (${budget.utilization}%).\n\n${
        over.length
          ? `Over limit: ${over.map((c) => `${c.category} (${c.utilization}%)`).join(", ")}.`
          : "No categories are over their limit."
      }\n${near.length ? `Approaching limit: ${near.map((c) => `${c.category} (${c.utilization}%)`).join(", ")}.` : ""}`,
      citations: budget.categories.slice(0, 5).map((category) => ({
        label: category.category,
        value: `${formatMoney(category.spentMinor, budget.currency)} / ${formatMoney(category.limitMinor, budget.currency)}`,
        href: "/app/budgets",
      })),
      disclaimer: DISCLAIMER,
    };
  }

  if (/(goal|save|saving)/.test(q)) {
    const goals = getGoals(db, user.id);
    const lines = goals
      .map(
        (goal) =>
          `${goal.name}: ${formatMoney(goal.currentMinor, goal.currency)} of ${formatMoney(
            goal.targetMinor,
            goal.currency,
          )} (${goal.progress}%)`,
      )
      .join("\n");
    return {
      intent: "goals",
      answer: goals.length
        ? `Your savings goals:\n${lines}\n\nContributions are real ledger transfers into dedicated goal accounts in this sandbox. No interest or return is promised.`
        : "You have no savings goals yet.",
      citations: goals.map((goal) => ({
        label: goal.name,
        value: `${goal.progress}%`,
        href: "/app/goals",
      })),
      disclaimer: DISCLAIMER,
    };
  }

  if (/(subscription|recurring|renew|bill)/.test(q)) {
    const recurring = getRecurring(db, "user", user.id, currency).slice(0, 6);
    const lines = recurring
      .map(
        (item) =>
          `${item.merchant}: about ${formatMoney(item.averageMinor, currency)} · next around ${new Date(
            item.nextDate,
          ).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}`,
      )
      .join("\n");
    return {
      intent: "recurring",
      answer: recurring.length
        ? `Recurring payments detected from your transaction history:\n${lines}\n\nThese are reminders only; cancelling a merchant subscription requires the merchant.`
        : "I could not detect recurring payments with enough history yet.",
      citations: recurring.map((item) => ({
        label: item.merchant,
        value: formatMoney(item.averageMinor, currency),
        href: "/app/bills",
      })),
      disclaimer: DISCLAIMER,
    };
  }

  if (/(transfer|payment).*(status|where|track)|status.*transfer/.test(q)) {
    const transfers = listTransfers(db, user.id, 1);
    if (transfers.length === 0) {
      return {
        intent: "transfer_status",
        answer: "You have no transfers yet.",
        citations: [],
        disclaimer: DISCLAIMER,
      };
    }
    const detail = getTransferDetail(db, transfers[0]!.id, user);
    return {
      intent: "transfer_status",
      answer: `Your latest transfer ${transfers[0]!.reference} is ${transfers[0]!.status.replace(
        "_",
        " ",
      )}. Source amount ${formatMoney(transfers[0]!.sourceAmountMinor, transfers[0]!.sourceCurrency)}${
        transfers[0]!.feeMinor ? ` with a ${formatMoney(transfers[0]!.feeMinor, transfers[0]!.sourceCurrency)} fee` : ""
      }.\n\n${detail?.hold?.status === "active" ? "Funds are currently held and not available to spend." : "No funds are currently held for this transfer."}`,
      citations: [
        {
          label: "Transfer",
          value: transfers[0]!.reference,
          href: `/app/transfers/${transfers[0]!.id}`,
        },
      ],
      disclaimer: DISCLAIMER,
    };
  }

  if (/(fx|exchange|rate|fee|currency)/.test(q)) {
    return {
      intent: "fx",
      answer:
        "FX quotes in this sandbox use a synthetic reference rate with a 35 bps markup, a minimum fee of 1.00 in the source currency, and a 90-second quote validity. The review screen shows the mid rate, fee, amount converted, recipient amount and effective rate. A quote is an estimate until you confirm it; expired quotes cannot be executed.",
      citations: [
        { label: "FX converter", value: "Open converter", href: "/app/fx" },
        { label: "Rate source", value: "Synthetic sandbox snapshot" },
      ],
      disclaimer: DISCLAIMER,
    };
  }

  if (/(secure|security|safe|protect|pin|mfa)/.test(q)) {
    return {
      intent: "security",
      answer:
        "Sensitive actions require a step-up PIN. Sessions are HttpOnly, server-validated and expire after eight hours. Every balance and transfer is enforced server-side against an immutable double-entry ledger, with holds for in-flight payments. Card numbers are never stored; only masked last-four details exist in the sandbox.",
      citations: [
        { label: "Security settings", value: "Review", href: "/app/settings" },
        { label: "Security model", value: "Read", href: "/security" },
      ],
      disclaimer: DISCLAIMER,
    };
  }

  if (/(recent|transaction|activity|last)/.test(q)) {
    const recent = listTransactions(db, "user", user.id, { limit: 5 }).rows;
    const lines = recent
      .map(
        (transaction) =>
          `${transaction.direction === "debit" ? "−" : "+"}${formatMoney(
            transaction.amountMinor,
            transaction.currency,
          )} · ${transaction.description} · ${transaction.status}`,
      )
      .join("\n");
    return {
      intent: "transactions",
      answer: `Your five most recent transactions:\n${lines}`,
      citations: recent.map((transaction) => ({
        label: transaction.description,
        value: `${transaction.direction === "debit" ? "−" : "+"}${formatMoney(
          transaction.amountMinor,
          transaction.currency,
        )}`,
        href: `/app/transactions?highlight=${transaction.id}`,
      })),
      disclaimer: DISCLAIMER,
    };
  }

  const month = monthKey();
  const { start, end } = monthBounds(month);
  const spend = dashboard.categories.reduce((acc, category) => acc + category.amountMinor, 0);
  return {
    intent: "overview",
    answer: `Here is your current sandbox position. Available balance is ${formatMoney(
      dashboard.availableUsdMinor,
      "USD",
    )} equivalent, with ${formatMoney(dashboard.heldMinor, "USD")} equivalent held for pending payments. This month: income ${formatMoney(
      dashboard.incomeMinor,
      currency,
    )}, spending ${formatMoney(spend, currency)}, savings rate ${dashboard.savingsRate}%. Ask me about spending categories, budgets, goals, recurring bills, a transfer status, or FX fees.`,
    citations: [
      { label: "Dashboard", value: "Open", href: "/app" },
      { label: "Insights", value: "Explore", href: "/app/insights" },
    ],
    disclaimer: DISCLAIMER,
  };
}
