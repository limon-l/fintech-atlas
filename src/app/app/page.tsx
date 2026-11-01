import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BellRing,
  CreditCard,
  Globe2,
  PieChart,
  Send,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { getDb } from "@/db/client";
import { requireUser } from "@/lib/auth";
import { getPersonalDashboard } from "@/server/finance";
import { PageHeader, Stat, SandboxNote, EmptyState, ProgressBar, Panel, Disclosure } from "@/components/ui/misc";
import { Money } from "@/components/ui/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CashflowChart, SpendDonut } from "@/components/ui/charts";
import { TransactionRow, CategoryIcon } from "@/components/app/finance-bits";
import { formatDate } from "@/lib/utils";

export default async function DashboardPage() {
  const user = await requireUser("/app");
  const db = getDb();
  const dashboard = getPersonalDashboard(db, user.id);
  const hour = new Date().getUTCHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = user.name.split(" ")[0];

  if (dashboard.portfolio.accounts.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Personal workspace" title={`${greeting}, ${firstName}`} description="Your sandbox workspace is ready." />
        <EmptyState
          title="No personal accounts in this workspace"
          description="This persona is an operations or business identity. Switch to the personal demo persona to explore customer banking."
          action={<Button asChild><Link href="/login">Choose a persona</Link></Button>}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={`${greeting} · ${formatDate(new Date())}`}
        title={`${greeting}, ${firstName}`}
        description="Your money, movements and decisions in one place. All figures are derived from the sandbox ledger."
        actions={
          <>
            <Button asChild variant="secondary" size="sm"><Link href="/app/fx"><Globe2 className="h-3.5 w-3.5" /> Convert</Link></Button>
            <Button asChild size="sm"><Link href="/app/transfers/new"><Send className="h-3.5 w-3.5" /> Send money</Link></Button>
          </>
        }
      />

      <SandboxNote />

      <section className="grid gap-4 lg:grid-cols-[1.55fr_1fr]">
        <div className="relative overflow-hidden rounded-[18px] border border-primary/20 bg-gradient-to-br from-[#0f1e35] via-[#142a52] to-[#0a4b49] p-5 text-white shadow-float sm:p-6">
          <div className="absolute inset-0 atlas-dots opacity-[0.14]" />
          <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#5fdccb]/15 blur-3xl" />
          <div className="relative">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">Total balance · indicative USD</p>
                <p className="amount mt-1.5 text-[38px] font-semibold leading-none tracking-[-0.045em] sm:text-[44px]">
                  <Money amountMinor={dashboard.portfolio.totalUsdMinor} currency="USD" />
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-[10.5px] text-white/50">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#5fdccb]" />
                    <Money amountMinor={dashboard.availableUsdMinor} currency="USD" /> available
                  </span>
                  {dashboard.heldMinor > 0 ? (
                    <span className="inline-flex items-center gap-1.5 text-[#f0b45e]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#f0b45e]" />
                      <Money amountMinor={dashboard.heldMinor} currency="USD" /> on hold
                    </span>
                  ) : null}
                </div>
              </div>
              <span className="mono hidden rounded-full border border-white/15 px-2.5 py-1 text-[8px] uppercase tracking-[0.14em] text-white/40 sm:block">
                Ledger-derived
              </span>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {dashboard.portfolio.accounts.slice(0, 6).map((account) => (
                <Link
                  key={account.id}
                  href={`/app/accounts/${account.id}`}
                  className="rounded-[10px] border border-white/10 bg-white/[0.04] px-3 py-2.5 transition-colors hover:bg-white/[0.08]"
                >
                  <div className="flex items-center justify-between">
                    <span className="mono text-[8.5px] font-semibold text-white/50">{account.currency}</span>
                    <span className="h-1.5 w-1.5 rounded-full bg-[#5fdccb]/70" />
                  </div>
                  <p className="amount mt-1 text-[12px] font-semibold text-white/90">
                    <Money amountMinor={account.ledgerMinor} currency={account.currency} />
                  </p>
                  <p className="mt-0.5 truncate text-[8.5px] text-white/35">{account.name}</p>
                </Link>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Button asChild size="sm" className="bg-white text-[#0f1e35] hover:bg-white/90">
                <Link href="/app/transfers/new"><Send className="h-3.5 w-3.5" /> Move money</Link>
              </Button>
              <Button asChild size="sm" variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10">
                <Link href="/app/accounts">All accounts <ArrowRight className="h-3.5 w-3.5" /></Link>
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-2">
          {[
            { href: "/app/transfers/new", label: "Send money", icon: Send, tone: "primary" },
            { href: "/app/fx", label: "Convert FX", icon: Globe2, tone: "teal" },
            { href: "/app/cards", label: "Card controls", icon: CreditCard, tone: "violet" },
            { href: "/app/insights", label: "Intelligence", icon: Sparkles, tone: "warning" },
          ].map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="group flex flex-col justify-between rounded-[14px] border border-border bg-surface p-4 transition-all hover:-translate-y-0.5 hover:border-border-strong hover:shadow-soft"
            >
              <span className={`flex h-9 w-9 items-center justify-center rounded-[10px] ${
                action.tone === "primary" ? "bg-primary-soft text-primary" : action.tone === "teal" ? "bg-teal-soft text-teal" : action.tone === "violet" ? "bg-violet-soft text-violet" : "bg-warning-soft text-warning"
              }`}>
                <action.icon className="h-4 w-4" />
              </span>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-[11.5px] font-semibold">{action.label}</span>
                <ArrowUpRight className="h-3.5 w-3.5 text-subtle transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Income this month"
          value={<Money amountMinor={dashboard.incomeMinor} currency={dashboard.currency} />}
          icon={<TrendingUp className="h-4 w-4" />}
          hint={`${formatDate(dashboard.month + "-01", { month: "long" })} to date`}
        />
        <Stat
          label="Spending this month"
          value={<Money amountMinor={dashboard.expenseMinor} currency={dashboard.currency} />}
          icon={<PieChart className="h-4 w-4" />}
          hint={dashboard.budget ? `${dashboard.budget.utilization}% of budget` : "No budget set"}
        />
        <Stat
          label="Savings rate"
          value={<span>{dashboard.savingsRate}%</span>}
          icon={<Target className="h-4 w-4" />}
          trend={dashboard.savingsRate >= 20 ? <Badge variant="success">On track</Badge> : <Badge variant="warning">Watch</Badge>}
          hint="Income minus spend"
        />
        <Stat
          label="Cards"
          value={<span>{(db.prepare("SELECT COUNT(*) AS count FROM cards WHERE owner_type='user' AND owner_id=?").get(user.id) as { count: number } | undefined)?.count ?? 0}</span>}
          icon={<CreditCard className="h-4 w-4" />}
          hint="Virtual cards under control"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Panel
          title="Cashflow"
          description="Six-month income and spending across your primary currency."
          action={<Badge variant="neutral">{dashboard.currency}</Badge>}
          bodyClassName="pt-2"
        >
          <div className="mb-3 flex items-center gap-4 px-1 text-[10px] text-muted">
            <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-chart-2" /> Income</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-chart-1" /> Spending</span>
            <span className="ml-auto mono text-[9px] text-subtle">Synthetic ledger</span>
          </div>
          <CashflowChart data={dashboard.cashflow} currency={dashboard.currency} height={244} />
        </Panel>

        <Panel
          title="Budget"
          description={dashboard.budget ? `${dashboard.budget.utilization}% used this month` : "No active budget"}
          action={<Link href="/app/budgets" className="text-[10.5px] font-semibold text-primary hover:underline">Manage</Link>}
        >
          {dashboard.budget ? (
            <div className="space-y-4">
              <div>
                <div className="flex items-end justify-between">
                  <Money amountMinor={dashboard.budget.spentMinor} currency={dashboard.budget.currency} className="text-[22px] font-semibold" />
                  <span className="text-[10.5px] text-muted">of <Money amountMinor={dashboard.budget.totalLimitMinor} currency={dashboard.budget.currency} compact /></span>
                </div>
                <ProgressBar
                  value={dashboard.budget.utilization}
                  tone={dashboard.budget.utilization > 90 ? "danger" : dashboard.budget.utilization > 70 ? "warning" : "success"}
                  className="mt-2.5 h-2"
                />
              </div>
              <div className="space-y-2.5">
                {dashboard.budget.categories.slice(0, 5).map((category) => (
                  <div key={category.category}>
                    <div className="flex items-center justify-between text-[10.5px]">
                      <span className="flex items-center gap-1.5 text-muted"><CategoryIcon category={category.category} className="h-3 w-3" /> {category.category}</span>
                      <span className="mono text-[9.5px] text-subtle">
                        <Money amountMinor={category.spentMinor} currency={dashboard.budget!.currency} compact /> / <Money amountMinor={category.limitMinor} currency={dashboard.budget!.currency} compact />
                      </span>
                    </div>
                    <ProgressBar
                      value={category.utilization}
                      tone={category.utilization > 100 ? "danger" : category.utilization > 80 ? "warning" : "primary"}
                      className="mt-1 h-1"
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState title="No budget yet" description="A monthly budget turns spending into a decision." />
          )}
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Panel
          title="Recent activity"
          description="Posted and processing movements across your accounts."
          action={<Link href="/app/transactions" className="text-[10.5px] font-semibold text-primary hover:underline">View all</Link>}
          bodyClassName="p-2"
        >
          {dashboard.recent.length === 0 ? (
            <EmptyState title="No transactions yet" className="m-3" />
          ) : (
            <div className="divide-y divide-border/50">
              {dashboard.recent.map((transaction) => (
                <TransactionRow key={transaction.id} transaction={transaction} showAccount />
              ))}
            </div>
          )}
        </Panel>

        <div className="space-y-4">
          <Panel
            title="Goals"
            description="Progress is the live balance of each goal account."
            action={<Link href="/app/goals" className="text-[10.5px] font-semibold text-primary hover:underline">Open</Link>}
          >
            {dashboard.goals.length === 0 ? (
              <EmptyState title="No goals yet" />
            ) : (
              <div className="space-y-4">
                {dashboard.goals.map((goal) => (
                  <div key={goal.id}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[11.5px] font-semibold">{goal.name}</p>
                        <p className="text-[9.5px] text-subtle">Target {formatDate(goal.targetDate)}</p>
                      </div>
                      <span className="mono text-[10px] font-semibold text-teal">{goal.progress}%</span>
                    </div>
                    <ProgressBar value={goal.progress} tone={goal.progress >= 100 ? "success" : "teal"} className="mt-2 h-1.5" />
                    <div className="mt-1.5 flex justify-between text-[9px] text-subtle">
                      <Money amountMinor={goal.currentMinor} currency={goal.currency} />
                      <Money amountMinor={goal.targetMinor} currency={goal.currency} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Where money went" description="Current-month category share">
            {dashboard.categories.length === 0 ? (
              <EmptyState title="No spend this month" />
            ) : (
              <>
                <SpendDonut data={dashboard.categories.slice(0, 6)} currency={dashboard.currency} height={170} />
                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
                  {dashboard.categories.slice(0, 6).map((category, index) => (
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
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Panel title="Top merchants" description="Current month, by spend">
          {dashboard.topMerchants.length === 0 ? (
            <EmptyState title="No merchant activity" />
          ) : (
            <div className="space-y-2.5">
              {dashboard.topMerchants.map((merchant) => (
                <div key={merchant.merchant} className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-2 text-muted">
                    <CategoryIcon category="Shopping" className="h-3 w-3" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-medium">{merchant.merchant}</p>
                    <p className="text-[9px] text-subtle">{merchant.count} transaction{merchant.count === 1 ? "" : "s"}</p>
                  </div>
                  <Money amountMinor={merchant.amountMinor} currency={dashboard.currency} className="text-[11px] font-semibold" />
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Recurring payments" description="Detected from repeated merchant activity" action={<Link href="/app/bills" className="text-[10.5px] font-semibold text-primary hover:underline">All</Link>}>
          {dashboard.recurring.length === 0 ? (
            <EmptyState title="No recurring payments detected" />
          ) : (
            <div className="space-y-2.5">
              {dashboard.recurring.map((item) => (
                <div key={`${item.merchant}-${item.category}`} className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-2 text-muted">
                    <BellRing className="h-3 w-3" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-medium">{item.merchant}</p>
                    <p className="text-[9px] text-subtle">Next ~{formatDate(item.nextDate)}</p>
                  </div>
                  <Money amountMinor={item.averageMinor} currency={item.currency} className="text-[11px] font-semibold" />
                </div>
              ))}
            </div>
          )}
        </Panel>
      </section>

      <Disclosure>
        USD equivalents use synthetic sandbox reference rates and are indicative only. Balances are
        derived from posted ledger entries; held amounts are not available to spend.
      </Disclosure>
    </div>
  );
}
