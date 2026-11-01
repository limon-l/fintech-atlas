import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Download, Filter, Search } from "lucide-react";
import { getDb } from "@/db/client";
import { requireUser } from "@/lib/auth";
import { listAccounts, listTransactions, type TransactionFilters } from "@/server/finance";
import { PageHeader, Panel, SandboxNote, EmptyState, Disclosure } from "@/components/ui/misc";
import { Money } from "@/components/ui/money";
import { Badge, StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { CategoryIcon, TransactionDateGroup } from "@/components/app/finance-bits";
import { cn, formatDate } from "@/lib/utils";

export const metadata = { title: "Transactions" };

const PAGE_SIZE = 25;

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const user = await requireUser("/app/transactions");
  const db = getDb();
  const accounts = listAccounts(db, "user", user.id);
  const value = (key: string) => {
    const raw = query[key];
    return typeof raw === "string" ? raw : "";
  };
  const page = Math.max(1, Number(value("page")) || 1);
  const filters: TransactionFilters = {
    accountId: value("account") || undefined,
    search: value("q") || undefined,
    category: value("category") || undefined,
    direction: (value("direction") as "credit" | "debit" | "") || undefined,
    status: value("status") || undefined,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  };
  const result = listTransactions(db, "user", user.id, filters);
  const categories = (
    db
      .prepare(
        `SELECT DISTINCT t.category FROM transactions t JOIN accounts a ON a.id = t.account_id
         WHERE a.owner_type = 'user' AND a.owner_id = ? ORDER BY t.category`,
      )
      .all(user.id) as Array<{ category: string }>
  ).map((row) => row.category);
  const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
  const credits = result.rows.filter((row) => row.direction === "credit").reduce((acc, row) => acc + row.amountMinor, 0);
  const debits = result.rows.filter((row) => row.direction === "debit").reduce((acc, row) => acc + row.amountMinor, 0);

  const grouped = new Map<string, typeof result.rows>();
  for (const row of result.rows) {
    const key = row.occurredAt.slice(0, 10);
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }

  const buildHref = (nextPage: number) => {
    const params = new URLSearchParams();
    for (const [key, raw] of Object.entries(query)) {
      if (typeof raw === "string" && raw && key !== "page") params.set(key, raw);
    }
    params.set("page", String(nextPage));
    return `/app/transactions?${params.toString()}`;
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Personal · activity"
        title="Transactions"
        description="Search every movement across your wallets. Each row links back to its journal, receipt and money-flow trace."
        actions={
          <Button asChild variant="secondary" size="sm">
            <Link href="/app/insights"><Download className="h-3.5 w-3.5" /> Export in Intelligence</Link>
          </Button>
        }
      />
      <SandboxNote />

      <Panel title="Filters" description="Filters apply to the server query, not just the visible page." bodyClassName="p-4">
        <form className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-6" action="/app/transactions">
          <div className="relative sm:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-subtle" />
            <Input name="q" defaultValue={value("q")} placeholder="Search merchant or description" className="pl-9" />
          </div>
          <Select name="account" defaultValue={value("account")} aria-label="Account">
            <option value="">All accounts</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>{account.name} · {account.currency}</option>
            ))}
          </Select>
          <Select name="category" defaultValue={value("category")} aria-label="Category">
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </Select>
          <Select name="direction" defaultValue={value("direction")} aria-label="Direction">
            <option value="">In and out</option>
            <option value="credit">Money in</option>
            <option value="debit">Money out</option>
          </Select>
          <div className="flex gap-2">
            <Select name="status" defaultValue={value("status")} aria-label="Status" className="min-w-0 flex-1">
              <option value="">Any status</option>
              <option value="posted">Posted</option>
              <option value="processing">Processing</option>
              <option value="failed">Failed</option>
              <option value="reversed">Reversed</option>
            </Select>
            <Button type="submit" size="md"><Filter className="h-3.5 w-3.5" /> Apply</Button>
          </div>
        </form>
      </Panel>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="surface-card p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-subtle">Matching movements</p>
          <p className="mt-2 text-[22px] font-semibold">{result.total}</p>
        </div>
        <div className="surface-card p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-subtle">Money in · this page</p>
          <Money amountMinor={credits} currency={accounts[0]?.currency ?? "USD"} className="mt-2 block text-[18px] font-semibold text-success" />
        </div>
        <div className="surface-card p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-subtle">Money out · this page</p>
          <Money amountMinor={debits} currency={accounts[0]?.currency ?? "USD"} className="mt-2 block text-[18px] font-semibold" />
        </div>
      </div>

      <Panel bodyClassName="p-2" title="Ledger-backed activity" description={`Page ${page} of ${totalPages}`}>
        {result.rows.length === 0 ? (
          <EmptyState title="No transactions match" description="Try clearing the filters or searching a different merchant." className="m-3" />
        ) : (
          <div>
            {[...grouped.entries()].map(([date, rows]) => (
              <div key={date}>
                <TransactionDateGroup date={date} />
                <div className="divide-y divide-border/40">
                  {rows.map((transaction) => {
                    const credit = transaction.direction === "credit";
                    return (
                      <Link
                        key={transaction.id}
                        href={`/app/transactions/${transaction.id}`}
                        className="group flex items-center gap-3 rounded-[8px] px-2 py-2.5 transition-colors hover:bg-surface-2/70"
                      >
                        <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", credit ? "bg-success-soft text-success" : "bg-surface-2 text-muted")}>
                          <CategoryIcon category={transaction.category} className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-[11.5px] font-semibold">{transaction.merchant ?? transaction.description}</p>
                            {transaction.status !== "posted" ? <StatusPill status={transaction.status} className="!px-1.5 !py-0.5 !text-[8px]" /> : null}
                          </div>
                          <p className="mt-0.5 truncate text-[9.5px] text-subtle">
                            {transaction.accountName} · {transaction.category}
                            {transaction.cardLast4 ? ` · card •••• ${transaction.cardLast4}` : ""}
                          </p>
                        </div>
                        <div className="text-right">
                          <Money
                            amountMinor={credit ? transaction.amountMinor : -transaction.amountMinor}
                            currency={transaction.currency}
                            signed
                            className={cn("text-[11.5px] font-semibold", credit && "text-success")}
                          />
                          <p className="mono mt-0.5 text-[8.5px] uppercase tracking-[0.06em] text-subtle">{transaction.currency}</p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] text-muted">Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, result.total)} of {result.total}</p>
          <div className="flex gap-2">
            <Button asChild variant="secondary" size="sm" disabled={page <= 1}>
              <Link href={buildHref(Math.max(1, page - 1))}>Previous</Link>
            </Button>
            <Button asChild variant="secondary" size="sm" disabled={page >= totalPages}>
              <Link href={buildHref(Math.min(totalPages, page + 1))}>Next</Link>
            </Button>
          </div>
        </div>
      ) : null}

      <Disclosure>
        Amounts are shown in the transaction currency. Cross-currency movements show the source and target legs on the detail page.
      </Disclosure>
    </div>
  );
}
