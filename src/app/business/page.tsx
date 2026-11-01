import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  CalendarClock,
  CircleAlert,
  FileText,
  ListChecks,
  Wallet,
} from "lucide-react";
import { getDb } from "@/db/client";
import { requireBusiness } from "@/lib/auth";
import { getBusinessOverview, listApprovals } from "@/server/business";
import { PageHeader, SandboxNote, Panel, Stat, ProgressBar, Disclosure, EmptyState } from "@/components/ui/misc";
import { Money } from "@/components/ui/money";
import { StatusPill, Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CashflowChart, SpendDonut } from "@/components/ui/charts";
import { formatDate, relativeTime } from "@/lib/utils";

export const metadata = { title: "Business overview" };

export default async function BusinessOverviewPage() {
  const ctx = await requireBusiness();
  const db = getDb();
  const overview = getBusinessOverview(db, ctx.orgId);
  const approvals = listApprovals(db, { user: ctx.user, orgId: ctx.orgId, role: ctx.role }, "pending").slice(0, 4);
  const primary = overview.accounts.find((account) => account.isPrimary) ?? overview.accounts[0];
  const currency = primary?.currency ?? ctx.baseCurrency;
  const monthNet = overview.incomingMinor - overview.outgoingMinor;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={`Business · ${ctx.orgName}`}
        title="Treasury overview"
        description={`Signed in as ${ctx.role.replace("_", " ")}. Cash, receivables, payables and approval pressure in one view.`}
        actions={
          <>
            <Button asChild variant="secondary" size="sm"><Link href="/business/invoices"><FileText className="h-3.5 w-3.5" /> Invoice</Link></Button>
            <Button asChild size="sm"><Link href="/business/approvals"><ListChecks className="h-3.5 w-3.5" /> Approvals {overview.pendingApprovals > 0 ? `· ${overview.pendingApprovals}` : ""}</Link></Button>
          </>
        }
      />
      <SandboxNote />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Total cash (USD eq.)"
          value={<Money amountMinor={overview.cashUsdMinor} currency="USD" />}
          hint={`${overview.accounts.length} accounts · indicative rates`}
          icon={<Wallet className="h-4 w-4" />}
        />
        <Stat
          label="Receivables"
          value={<Money amountMinor={overview.receivablesMinor} currency={currency} />}
          hint={`${overview.overdueReceivablesMinor > 0 ? "Overdue " : ""}${(overview.overdueReceivablesMinor / 100).toLocaleString("en-US", { style: "currency", currency })}`}
          icon={<ArrowDownLeft className="h-4 w-4" />}
          trend={overview.overdueReceivablesMinor > 0 ? <Badge variant="danger">Overdue</Badge> : <Badge variant="success">On track</Badge>}
        />
        <Stat
          label="Payables"
          value={<Money amountMinor={overview.payablesMinor} currency={currency} />}
          hint="Awaiting approval, approved or scheduled"
          icon={<ArrowUpRight className="h-4 w-4" />}
        />
        <Stat
          label="Pending approvals"
          value={overview.pendingApprovals}
          hint={<Money amountMinor={overview.pendingApprovalValueMinor} currency={currency} />}
          icon={<ListChecks className="h-4 w-4" />}
          trend={overview.pendingApprovals > 0 ? <Badge variant="warning">Action</Badge> : <Badge variant="success">Clear</Badge>}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Panel title="Cashflow" description="Six months, USD-equivalent posted movements">
          <div className="mb-3 flex flex-wrap items-center gap-4 text-[10.5px] text-muted">
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[var(--chart-2)]" /> Inflow</span>
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[var(--chart-1)]" /> Outflow</span>
            <span className="ml-auto mono text-[9.5px] text-subtle">This month net <Money amountMinor={monthNet} currency="USD" signed /></span>
          </div>
          <CashflowChart data={overview.cashflow} currency="USD" height={230} />
        </Panel>

        <Panel title="Spend mix" description="Current month by category">
          {overview.categories.length === 0 ? (
            <EmptyState title="No spend this month" />
          ) : (
            <>
              <SpendDonut data={overview.categories.slice(0, 6)} currency="USD" height={170} />
              <div className="mt-2 space-y-1">
                {overview.categories.slice(0, 5).map((category, index) => (
                  <div key={category.category} className="flex items-center gap-2 text-[10px] text-muted">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: `var(--chart-${(index % 6) + 1})` }} />
                    <span className="truncate">{category.category}</span>
                    <span className="mono ml-auto text-[9px] text-subtle">{category.share}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Panel>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Panel title="Approval queue" description="Pending requests" action={<Button asChild variant="ghost" size="sm"><Link href="/business/approvals">View all</Link></Button>}>
          {approvals.length === 0 ? (
            <EmptyState title="Queue is clear" description="No pending approvals." />
          ) : (
            <div className="space-y-2">
              {approvals.map((approval) => (
                <Link key={approval.id} href={`/business/approvals/${approval.id}`} className="block rounded-[10px] border border-border bg-surface px-3 py-2.5 transition-colors hover:bg-surface-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-semibold">{approval.title}</p>
                      <p className="mt-0.5 text-[9px] text-subtle">{approval.requestedByName} · {relativeTime(approval.createdAt)}</p>
                    </div>
                    <Money amountMinor={approval.amountMinor} currency={approval.currency} className="text-[11px] font-semibold" />
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <StatusPill status={approval.status} />
                    <span className="text-[9px] text-subtle">Step {approval.currentStep} of {approval.totalSteps}</span>
                    {approval.myTurn ? <Badge variant="primary">Your turn</Badge> : null}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Aging" description="Receivables and payables by bucket">
          <div className="space-y-3">
            {overview.aging.receivables.map((bucket) => (
              <div key={`recv-${bucket.bucket}`}>
                <div className="flex items-center justify-between text-[10.5px]">
                  <span className="text-muted">Receivable · {bucket.bucket}</span>
                  <Money amountMinor={bucket.amountMinor} currency={currency} className="font-semibold" />
                </div>
                <ProgressBar
                  value={overview.receivablesMinor === 0 ? 0 : Math.round((bucket.amountMinor / overview.receivablesMinor) * 100)}
                  tone={bucket.bucket === "60+ days" ? "danger" : bucket.bucket === "Current" ? "success" : "warning"}
                  className="mt-1 h-1"
                />
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-3 border-t border-border/70 pt-3">
            {overview.aging.payables.map((bucket) => (
              <div key={`pay-${bucket.bucket}`}>
                <div className="flex items-center justify-between text-[10.5px]">
                  <span className="text-muted">Payable · {bucket.bucket}</span>
                  <Money amountMinor={bucket.amountMinor} currency={currency} className="font-semibold" />
                </div>
                <ProgressBar
                  value={overview.payablesMinor === 0 ? 0 : Math.round((bucket.amountMinor / overview.payablesMinor) * 100)}
                  tone={bucket.bucket === "60+ days" ? "danger" : bucket.bucket === "Current" ? "success" : "warning"}
                  className="mt-1 h-1"
                />
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Accounts" description="Business wallets">
          {overview.accounts.length === 0 ? (
            <EmptyState title="No business accounts" />
          ) : (
            <div className="space-y-2">
              {overview.accounts.map((account) => (
                <div key={account.id} className="rounded-[10px] border border-border bg-surface px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-soft text-primary"><Building2 className="h-3 w-3" /></span>
                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-semibold">{account.name}</p>
                        <p className="text-[9px] text-subtle">{account.kind} · {account.currency}</p>
                      </div>
                    </div>
                    <Money amountMinor={account.availableMinor} currency={account.currency} className="text-[11px] font-semibold" />
                  </div>
                  {account.heldMinor > 0 ? <p className="mt-1 text-[9px] text-warning"><Money amountMinor={account.heldMinor} currency={account.currency} /> held</p> : null}
                </div>
              ))}
            </div>
          )}
        </Panel>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Panel title="Recent activity" description="Latest organization transactions">
          {overview.recent.length === 0 ? (
            <EmptyState title="No activity" />
          ) : (
            <div className="divide-y divide-border/70">
              {overview.recent.slice(0, 6).map((transaction) => (
                <div key={transaction.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full ${transaction.direction === "credit" ? "bg-success-soft text-success" : "bg-surface-2 text-muted"}`}>
                    {transaction.direction === "credit" ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-semibold">{transaction.description}</p>
                    <p className="text-[9px] text-subtle">{transaction.accountName} · {formatDate(transaction.occurredAt)}</p>
                  </div>
                  <Money amountMinor={transaction.direction === "credit" ? transaction.amountMinor : -transaction.amountMinor} currency={transaction.currency} signed className="text-[11px] font-semibold" />
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Controls & signals" description="Policy checks in this workspace">
          <div className="space-y-3">
            <div className="flex items-start gap-3 rounded-[10px] border border-border bg-surface-2/40 p-3">
              <CircleAlert className={`mt-0.5 h-4 w-4 shrink-0 ${overview.policyFlags > 0 ? "text-warning" : "text-success"}`} />
              <div>
                <p className="text-[11.5px] font-semibold">{overview.policyFlags} expense{overview.policyFlags === 1 ? "" : "s"} over policy</p>
                <p className="mt-0.5 text-[10.5px] text-muted">Compared against active per-transaction spending policies.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-[10px] border border-border bg-surface-2/40 p-3">
              <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-info" />
              <div>
                <p className="text-[11.5px] font-semibold">Maker-checker enforced</p>
                <p className="mt-0.5 text-[10.5px] text-muted">You cannot approve your own request. Bills and expenses require two role steps plus a PIN.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-[10px] border border-border bg-surface-2/40 p-3">
              <ListChecks className="mt-0.5 h-4 w-4 shrink-0 text-violet" />
              <div>
                <p className="text-[11.5px] font-semibold">Your role: {ctx.role.replace("_", " ")}</p>
                <p className="mt-0.5 text-[10.5px] text-muted">Permissions are checked server-side in every service call, not hidden in the UI.</p>
              </div>
            </div>
          </div>
        </Panel>
      </section>

      <Disclosure>
        All balances, invoices, bills and approvals are synthetic sandbox records. No live payment rails are connected.
      </Disclosure>
    </div>
  );
}
