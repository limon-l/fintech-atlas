import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, BarChart3, PieChart, Timer } from "lucide-react";
import { getDb } from "@/db/client";
import { requireBusiness } from "@/lib/auth";
import { getBusinessReports } from "@/server/business";
import { PageHeader, SandboxNote, Panel, Stat, ProgressBar, Disclosure } from "@/components/ui/misc";
import { Money } from "@/components/ui/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CashflowChart, MiniBars, SpendDonut } from "@/components/ui/charts";

export const metadata = { title: "Reports" };

export default async function ReportsPage() {
  const ctx = await requireBusiness("report:read");
  const reports = getBusinessReports(getDb(), ctx.orgId);
  const currency = ctx.baseCurrency;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={`Business · ${ctx.orgName}`}
        title="Financial reports"
        description="Cashflow, spend concentration and approval throughput computed from the same ledger and workflow tables."
        actions={<Button asChild variant="secondary" size="sm"><Link href="/business/developers"><BarChart3 className="h-3.5 w-3.5" /> Export via API</Link></Button>}
      />
      <SandboxNote />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Revenue this month" value={<Money amountMinor={reports.revenueMinor} currency={currency} />} hint="Posted credits" icon={<ArrowDownRight className="h-4 w-4" />} />
        <Stat label="Expense this month" value={<Money amountMinor={reports.expenseMinor} currency={currency} />} hint="Posted debits" icon={<ArrowUpRight className="h-4 w-4" />} />
        <Stat label="Net" value={<Money amountMinor={reports.netMinor} currency={currency} signed />} hint="Revenue minus expense" icon={<PieChart className="h-4 w-4" />} trend={<Badge variant={reports.netMinor >= 0 ? "success" : "danger"}>{reports.netMinor >= 0 ? "Positive" : "Negative"}</Badge>} />
        <Stat label="Avg approval time" value={`${reports.approvalStats.averageHours}h`} hint={`${reports.approvalStats.pending} pending`} icon={<Timer className="h-4 w-4" />} />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Panel title="Six-month cashflow" description={`USD-equivalent movements`}>
          <CashflowChart data={reports.cashflow} currency="USD" height={240} />
        </Panel>
        <Panel title="Spend categories" description="Current month">
          {reports.categories.length === 0 ? (
            <p className="py-10 text-center text-[12px] text-muted">No spend recorded this month.</p>
          ) : (
            <>
              <SpendDonut data={reports.categories.slice(0, 6)} currency="USD" height={180} />
              <div className="mt-2 space-y-1">
                {reports.categories.slice(0, 5).map((category, index) => (
                  <div key={category.category} className="flex items-center gap-2 text-[10px] text-muted">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: `var(--chart-${(index % 6) + 1})` }} />
                    <span className="truncate">{category.category}</span>
                    <span className="ml-auto mono text-[9px] text-subtle">{category.share}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Panel>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Panel title="Receivables aging" description="Open invoices by days past due">
          <div className="space-y-3">
            {reports.receivablesAging.map((bucket) => (
              <div key={bucket.bucket}>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted">{bucket.bucket} <span className="text-subtle">· {bucket.count}</span></span>
                  <Money amountMinor={bucket.amountMinor} currency={currency} className="font-semibold" />
                </div>
                <ProgressBar
                  value={Math.min(100, bucket.amountMinor / 1000)}
                  tone={bucket.bucket === "60+ days" ? "danger" : bucket.bucket === "Current" ? "success" : "warning"}
                  className="mt-1 h-1"
                />
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Payables aging" description="Open bills by days past due">
          <div className="space-y-3">
            {reports.payablesAging.map((bucket) => (
              <div key={bucket.bucket}>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted">{bucket.bucket} <span className="text-subtle">· {bucket.count}</span></span>
                  <Money amountMinor={bucket.amountMinor} currency={currency} className="font-semibold" />
                </div>
                <ProgressBar
                  value={Math.min(100, bucket.amountMinor / 1000)}
                  tone={bucket.bucket === "60+ days" ? "danger" : bucket.bucket === "Current" ? "success" : "warning"}
                  className="mt-1 h-1"
                />
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Panel title="Vendor concentration" description="Share of total billed value">
          {reports.vendorConcentration.length === 0 ? (
            <p className="py-8 text-center text-[12px] text-muted">No vendor bills yet.</p>
          ) : (
            <div className="space-y-3">
              {reports.vendorConcentration.map((vendor) => (
                <div key={vendor.vendor}>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="truncate text-muted">{vendor.vendor}</span>
                    <span className="mono text-[9.5px] text-subtle">{vendor.share}%</span>
                  </div>
                  <ProgressBar value={vendor.share} tone={vendor.share > 50 ? "danger" : "primary"} className="mt-1 h-1.5" />
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Spend by project" description="Employee expenses, USD-equivalent">
          {reports.departmentSpend.length === 0 ? (
            <p className="py-8 text-center text-[12px] text-muted">No project spend recorded.</p>
          ) : (
            <MiniBars data={reports.departmentSpend.map((row) => ({ label: row.name, value: row.amountMinor }))} currency="USD" height={200} />
          )}
        </Panel>
      </section>

      <Panel title="Approval throughput" description="Counts by outcome">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ["Pending", reports.approvalStats.pending, "warning"],
            ["Approved", reports.approvalStats.approved, "success"],
            ["Rejected", reports.approvalStats.rejected, "danger"],
          ].map(([label, count, tone]) => (
            <div key={String(label)} className="rounded-[10px] border border-border bg-surface-2/40 p-3">
              <p className="text-[10px] uppercase tracking-[0.1em] text-subtle">{String(label)}</p>
              <p className="mt-1 text-[20px] font-semibold">{String(count)}</p>
              <Badge variant={tone as "warning" | "success" | "danger"} className="mt-1">requests</Badge>
            </div>
          ))}
        </div>
      </Panel>

      <Disclosure>Reports are derived from synthetic sandbox data. They are not audited financial statements.</Disclosure>
    </div>
  );
}
