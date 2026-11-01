import Link from "next/link";
import { AlertTriangle, PieChart, Plus, Target, TrendingDown } from "lucide-react";
import { getDb } from "@/db/client";
import { requireUser } from "@/lib/auth";
import { getBudget, getCashflow, getSpendingByCategory, monthBounds } from "@/server/finance";
import { PageHeader, SandboxNote, Panel, Stat, ProgressBar, EmptyState, Disclosure, InlineAlert } from "@/components/ui/misc";
import { Money } from "@/components/ui/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SpendDonut, MiniBars } from "@/components/ui/charts";
import { BudgetEditor } from "@/components/app/budget-editor";
import { monthKey, monthLabel } from "@/lib/utils";

export const metadata = { title: "Budgets" };

export default async function BudgetsPage() {
  const user = await requireUser("/app/budgets");
  const db = getDb();
  const month = monthKey();
  const budget = getBudget(db, user.id, month);
  const { start, end } = monthBounds(month);
  const currency = budget?.currency ?? "USD";
  const categories = getSpendingByCategory(db, "user", user.id, currency, start, end);
  const cashflow = getCashflow(db, "user", user.id, currency, 6);
  const overspent = budget?.categories.filter((category) => category.utilization > 100) ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={`Personal · ${monthLabel(month)}`}
        title="Budgets"
        description="A budget is a set of integer limits checked against posted spending. Edit a category and the total recalculates server-side."
        actions={<Button asChild variant="secondary" size="sm"><Link href="/app/insights"><PieChart className="h-3.5 w-3.5" /> Intelligence</Link></Button>}
      />
      <SandboxNote />

      {!budget ? (
        <EmptyState title="No budget for this month" description="Seed the demo as Maya Chen to inspect a live budget, or create one from the API in a later release." />
      ) : (
        <>
          <section className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
            <div className="relative overflow-hidden rounded-[18px] border border-border bg-surface p-5 shadow-soft sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="eyebrow">Budget used</p>
                  <p className="amount mt-2 text-[34px] font-semibold tracking-[-0.04em]"><Money amountMinor={budget.spentMinor} currency={budget.currency} /></p>
                  <p className="mt-1 text-[11px] text-muted">
                    of <Money amountMinor={budget.totalLimitMinor} currency={budget.currency} /> · <Money amountMinor={Math.max(0, budget.totalLimitMinor - budget.spentMinor)} currency={budget.currency} /> remaining
                  </p>
                </div>
                <Badge variant={budget.utilization > 90 ? "danger" : budget.utilization > 70 ? "warning" : "success"}>
                  {budget.utilization}% used
                </Badge>
              </div>
              <ProgressBar value={budget.utilization} tone={budget.utilization > 90 ? "danger" : budget.utilization > 70 ? "warning" : "success"} className="mt-5 h-2.5" />
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <div className="rounded-[9px] bg-surface-2 px-3 py-2">
                  <p className="text-[8.5px] uppercase tracking-[0.1em] text-subtle">Categories</p>
                  <p className="mt-0.5 text-[13px] font-semibold">{budget.categories.length}</p>
                </div>
                <div className="rounded-[9px] bg-surface-2 px-3 py-2">
                  <p className="text-[8.5px] uppercase tracking-[0.1em] text-subtle">Over limit</p>
                  <p className={`mt-0.5 text-[13px] font-semibold ${overspent.length > 0 ? "text-danger" : ""}`}>{overspent.length}</p>
                </div>
                <div className="rounded-[9px] bg-surface-2 px-3 py-2">
                  <p className="text-[8.5px] uppercase tracking-[0.1em] text-subtle">Currency</p>
                  <p className="mt-0.5 text-[13px] font-semibold">{budget.currency}</p>
                </div>
              </div>
            </div>

            <Panel title="Where money went" description="Current month debit share by category">
              {categories.length === 0 ? <EmptyState title="No spend this month" /> : (
                <>
                  <SpendDonut data={categories.slice(0, 7)} currency={budget.currency} height={180} />
                  <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
                    {categories.slice(0, 7).map((category, index) => (
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

          {overspent.length > 0 ? (
            <InlineAlert tone="warning" title={`${overspent.length} category${overspent.length === 1 ? "" : "ies"} over limit`}>
              {overspent.map((category) => category.category).join(", ")}. Limits are guidance, not a payment block — card controls are the enforcement layer.
            </InlineAlert>
          ) : null}

          <section>
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <h2 className="text-[16px] font-semibold tracking-tight">Category limits</h2>
                <p className="text-[11.5px] text-muted">Click the pencil to change a limit. The monthly total is the sum of categories.</p>
              </div>
              <Button asChild variant="secondary" size="sm"><Link href="/app/cards"><Plus className="h-3.5 w-3.5" /> Enforce with cards</Link></Button>
            </div>
            <BudgetEditor budget={budget} />
          </section>
        </>
      )}

      <section className="grid gap-4 lg:grid-cols-2">
        <Panel title="Six-month net" description={`Income minus spend in ${currency}`}>
          <MiniBars data={cashflow.map((point) => ({ label: point.label, value: point.netMinor }))} currency={currency} height={190} tone="var(--chart-2)" />
        </Panel>
        <Panel title="Budget discipline" description="How the numbers are produced">
          <ul className="space-y-3">
            {[
              ["Posted and processing only", "Failed and reversed rows are excluded from spending totals."],
              ["Month boundaries in UTC", "A movement lands in exactly one budget month, regardless of client timezone."],
              ["Limits are guidance", "Card controls decline transactions; budgets measure and warn."],
              ["Integer arithmetic", "Limits and spend are integer minor units. No floating-point drift."],
            ].map(([title, body], index) => (
              <li key={title} className="flex gap-3">
                <span className="mono flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[9px] font-semibold text-muted">{index + 1}</span>
                <div><p className="text-[11.5px] font-semibold">{title}</p><p className="mt-0.5 text-[10.5px] leading-relaxed text-muted">{body}</p></div>
              </li>
            ))}
          </ul>
        </Panel>
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Monthly income" value={<Money amountMinor={cashflow[cashflow.length - 1]?.incomeMinor ?? 0} currency={currency} />} icon={<Target className="h-4 w-4" />} hint="Current month" />
        <Stat label="Monthly spend" value={<Money amountMinor={cashflow[cashflow.length - 1]?.expenseMinor ?? 0} currency={currency} />} icon={<TrendingDown className="h-4 w-4" />} hint="Posted debits" />
        <Stat label="Net" value={<Money amountMinor={cashflow[cashflow.length - 1]?.netMinor ?? 0} currency={currency} signed />} icon={<AlertTriangle className="h-4 w-4" />} hint="Income minus spend" />
      </div>

      <Disclosure>Budgets are a planning aid in this sandbox. They do not constitute financial advice or a guarantee of card authorization behaviour.</Disclosure>
    </div>
  );
}
