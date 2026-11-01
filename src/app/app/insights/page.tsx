import Link from "next/link";
import { ArrowUpRight, BarChart3, Download, PieChart, Sparkles, TrendingUp } from "lucide-react";
import { getDb } from "@/db/client";
import { requireUser } from "@/lib/auth";
import { getCashflow, getPersonalDashboard, getSpendingByCategory, getTopMerchants, monthBounds } from "@/server/finance";
import { SUGGESTED_PROMPTS } from "@/server/assistant";
import { PageHeader, SandboxNote, Panel, Stat, Disclosure, EmptyState } from "@/components/ui/misc";
import { Money } from "@/components/ui/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CashflowChart, MiniBars, SpendDonut } from "@/components/ui/charts";
import { AtlasAssistant } from "@/components/app/atlas-assistant";
import { CategoryIcon } from "@/components/app/finance-bits";
import { monthKey } from "@/lib/utils";

export const metadata = { title: "Intelligence" };

export default async function InsightsPage() {
  const user = await requireUser("/app/insights");
  const db = getDb();
  const dashboard = getPersonalDashboard(db, user.id);
  const month = monthKey();
  const { start, end } = monthBounds(month);
  const currency = dashboard.currency;
  const categories = getSpendingByCategory(db, "user", user.id, currency, start, end);
  const merchants = getTopMerchants(db, "user", user.id, currency, start, end, 8);
  const cashflow = getCashflow(db, "user", user.id, currency, 6);
  const totalSpend = categories.reduce((acc, category) => acc + category.amountMinor, 0);
  const previous = cashflow[cashflow.length - 2];
  const current = cashflow[cashflow.length - 1];
  const change = previous && previous.expenseMinor > 0 ? Math.round(((current!.expenseMinor - previous.expenseMinor) / previous.expenseMinor) * 100) : 0;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Personal · intelligence"
        title="Intelligence"
        description="Deterministic analytics over your ledger. Every number is reproducible from postings — no black-box scoring."
        actions={
          <Button asChild variant="secondary" size="sm">
            <Link href="/api/v1/transactions?format=csv"><Download className="h-3.5 w-3.5" /> Export CSV</Link>
          </Button>
        }
      />
      <SandboxNote />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Income this month" value={<Money amountMinor={current?.incomeMinor ?? 0} currency={currency} />} icon={<TrendingUp className="h-4 w-4" />} hint="Posted and processing credits" />
        <Stat label="Spending this month" value={<Money amountMinor={current?.expenseMinor ?? 0} currency={currency} />} icon={<PieChart className="h-4 w-4" />} hint={`${change >= 0 ? "+" : ""}${change}% vs last month`} trend={<Badge variant={change > 0 ? "warning" : "success"}>{change > 0 ? "Up" : "Down"}</Badge>} />
        <Stat label="Net cashflow" value={<Money amountMinor={current?.netMinor ?? 0} currency={currency} signed />} icon={<BarChart3 className="h-4 w-4" />} hint="Income minus spend" />
        <Stat label="Savings rate" value={`${dashboard.savingsRate}%`} icon={<Sparkles className="h-4 w-4" />} hint="Of income retained" trend={<Badge variant={dashboard.savingsRate >= 20 ? "success" : "warning"}>{dashboard.savingsRate >= 20 ? "Healthy" : "Watch"}</Badge>} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <Panel title="Six-month cashflow" description={`Income and spending in ${currency}`} action={<Badge variant="neutral">{currency}</Badge>} bodyClassName="pt-2">
          <div className="mb-2 flex items-center gap-4 px-1 text-[10px] text-muted">
            <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-chart-2" /> Income</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-chart-1" /> Spending</span>
            <span className="ml-auto mono text-[8.5px] text-subtle">UTC months</span>
          </div>
          <CashflowChart data={cashflow} currency={currency} height={260} />
        </Panel>

        <Panel title="Category mix" description="Share of current-month spend">
          {categories.length === 0 ? <EmptyState title="No spend this month" /> : (
            <>
              <SpendDonut data={categories.slice(0, 8)} currency={currency} height={190} />
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
                {categories.slice(0, 8).map((category, index) => (
                  <div key={category.category} className="flex items-center gap-1.5 text-[9.5px] text-muted">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: `var(--chart-${(index % 6) + 1})` }} />
                    <span className="truncate">{category.category}</span>
                    <span className="mono ml-auto text-[8.5px] text-subtle">{category.share}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_1fr]">
        <Panel title="Spending by category" description="Click through to the filtered transaction list" bodyClassName="p-0">
          {categories.length === 0 ? <EmptyState title="No spend this month" className="m-4" /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border text-[9px] uppercase tracking-[0.1em] text-subtle">
                    <th className="px-5 py-2.5 font-semibold">Category</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Spend</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Share</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Count</th>
                    <th className="px-5 py-2.5 text-right font-semibold" />
                  </tr>
                </thead>
                <tbody>
                  {categories.map((category) => (
                    <tr key={category.category} className="border-b border-border/50 last:border-0 hover:bg-surface-2/50">
                      <td className="px-5 py-3">
                        <span className="flex items-center gap-2 text-[11px] font-medium"><CategoryIcon category={category.category} className="h-3.5 w-3.5 text-muted" /> {category.category}</span>
                      </td>
                      <td className="px-3 py-3 text-right"><Money amountMinor={category.amountMinor} currency={currency} className="text-[11px] font-semibold" /></td>
                      <td className="px-3 py-3 text-right"><span className="mono text-[10px] text-muted">{category.share}%</span></td>
                      <td className="px-3 py-3 text-right"><span className="mono text-[10px] text-muted">{category.count}</span></td>
                      <td className="px-5 py-3 text-right">
                        <Link href={`/app/transactions?category=${encodeURIComponent(category.category)}`} className="text-primary hover:underline"><ArrowUpRight className="h-3.5 w-3.5" /></Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <div className="space-y-4">
          <Panel title="Top merchants" description="Current month by spend">
            {merchants.length === 0 ? <EmptyState title="No merchant activity" /> : (
              <div className="space-y-2.5">
                {merchants.map((merchant, index) => (
                  <div key={merchant.merchant} className="flex items-center gap-2.5">
                    <span className="mono flex h-6 w-6 items-center justify-center rounded-full bg-surface-2 text-[9px] font-semibold text-muted">{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-medium">{merchant.merchant}</p>
                      <p className="text-[9px] text-subtle">{merchant.count} charge{merchant.count === 1 ? "" : "s"} · {totalSpend === 0 ? 0 : Math.round((merchant.amountMinor / totalSpend) * 100)}% of spend</p>
                    </div>
                    <Money amountMinor={merchant.amountMinor} currency={currency} className="text-[11px] font-semibold" />
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Net by month" description="Income minus spending">
            <MiniBars data={cashflow.map((point) => ({ label: point.label, value: point.netMinor }))} currency={currency} height={170} tone="var(--chart-3)" />
          </Panel>
        </div>
      </section>

      <AtlasAssistant prompts={SUGGESTED_PROMPTS} />

      <Panel title="Methodology" description="Why these numbers can be trusted">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ["Ledger-derived", "Spend is the sum of posted and processing debit transactions joined to owned accounts. Nothing is estimated."],
            ["Currency-scoped", "Category analytics run in your primary currency so shares are comparable."],
            ["Explainable assistant", "The assistant maps your question to a fixed rule and cites the records it used. It cannot act."],
          ].map(([title, body]) => (
            <div key={title} className="rounded-[10px] border border-border bg-surface-2/50 p-3">
              <p className="text-[10.5px] font-semibold">{title}</p>
              <p className="mt-1 text-[10px] leading-relaxed text-muted">{body}</p>
            </div>
          ))}
        </div>
      </Panel>

      <Disclosure>Analytics are sandbox reporting, not financial advice. USD equivalents use synthetic reference rates.</Disclosure>
    </div>
  );
}
