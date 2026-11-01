import Link from "next/link";
import { ArrowUpRight, CalendarClock, RefreshCw, ReceiptText, Repeat2 } from "lucide-react";
import { getDb } from "@/db/client";
import { requireUser } from "@/lib/auth";
import { getRecurring, listAccounts } from "@/server/finance";
import { PageHeader, SandboxNote, Panel, Stat, EmptyState, Disclosure } from "@/components/ui/misc";
import { Money } from "@/components/ui/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CategoryIcon } from "@/components/app/finance-bits";
import { formatDate, relativeTime } from "@/lib/utils";

export const metadata = { title: "Bills & recurring" };

export default async function BillsPage() {
  const user = await requireUser("/app/bills");
  const db = getDb();
  const accounts = listAccounts(db, "user", user.id);
  const currency = accounts.find((account) => account.isPrimary)?.currency ?? "USD";
  const recurring = getRecurring(db, "user", user.id, currency);
  const monthly = recurring.reduce((acc, item) => acc + item.averageMinor, 0);
  const upcoming = [...recurring].sort((a, b) => new Date(a.nextDate).getTime() - new Date(b.nextDate).getTime());

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Personal · recurring"
        title="Bills & recurring"
        description="Recurring payments are detected from repeated merchant activity over the last 120 days. They are observations, not scheduled mandates."
        actions={<Button asChild variant="secondary" size="sm"><Link href="/app/transactions"><ReceiptText className="h-3.5 w-3.5" /> Transactions</Link></Button>}
      />
      <SandboxNote />

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label="Detected merchants" value={recurring.length} hint="At least two debits in 120 days" icon={<Repeat2 className="h-4 w-4" />} />
        <Stat label="Estimated monthly" value={<Money amountMinor={monthly} currency={currency} />} hint="Sum of average debits" icon={<RefreshCw className="h-4 w-4" />} />
        <Stat label="Next expected" value={upcoming[0] ? formatDate(upcoming[0].nextDate) : "—"} hint={upcoming[0]?.merchant ?? "No recurring activity"} icon={<CalendarClock className="h-4 w-4" />} />
      </section>

      {recurring.length === 0 ? (
        <EmptyState title="No recurring payments detected" description="As repeated merchant debits accumulate, they will appear here automatically." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <Panel title="Upcoming" description="Ordered by expected next charge" bodyClassName="p-2">
            <div className="divide-y divide-border/50">
              {upcoming.map((item) => (
                <div key={`${item.merchant}-${item.category}`} className="flex items-center gap-3 px-2 py-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-2 text-muted"><CategoryIcon category={item.category} className="h-3.5 w-3.5" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11.5px] font-semibold">{item.merchant}</p>
                    <p className="text-[9.5px] text-subtle">{item.category} · {item.occurrences} charges · last {relativeTime(item.lastDate)}</p>
                  </div>
                  <div className="text-right">
                    <Money amountMinor={item.averageMinor} currency={item.currency} className="text-[11.5px] font-semibold" />
                    <p className="text-[8.5px] text-subtle">~{formatDate(item.nextDate)}</p>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <div className="space-y-4">
            <Panel title="Annualised" description="Simple average × 12, not a forecast">
              <Money amountMinor={monthly * 12} currency={currency} className="text-[26px] font-semibold" />
              <p className="mt-1 text-[10.5px] text-muted">If the current pattern continued unchanged.</p>
              <div className="mt-3 space-y-1.5">
                {recurring.slice(0, 5).map((item) => (
                  <div key={item.merchant} className="flex items-center justify-between text-[9.5px]">
                    <span className="truncate text-muted">{item.merchant}</span>
                    <span className="mono text-subtle">{Math.round((item.averageMinor / (monthly || 1)) * 100)}%</span>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Manage" description="What you can do today">
              <ul className="space-y-2 text-[10.5px] text-muted">
                <li className="flex gap-2"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />Freeze the card used for a subscription from the card studio.</li>
                <li className="flex gap-2"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-teal" />Lower a per-transaction limit to block high charges.</li>
                <li className="flex gap-2"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-violet" />Budgets warn; card controls enforce.</li>
              </ul>
              <Button asChild variant="secondary" size="sm" className="mt-3 w-full"><Link href="/app/cards">Open card studio <ArrowUpRight className="h-3.5 w-3.5" /></Link></Button>
            </Panel>
          </div>
        </div>
      )}

      <Panel title="Detection method" description="Transparent, deterministic, no machine-learning claims">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ["Group", "Debits with a merchant name are grouped by merchant and category."],
            ["Threshold", "A group needs at least two posted debits in the last 120 days."],
            ["Estimate", "The average debit is shown, and the next date is last charge + 30 days."],
          ].map(([title, body]) => (
            <div key={title} className="rounded-[10px] border border-border bg-surface-2/50 p-3">
              <p className="text-[10.5px] font-semibold">{title}</p>
              <p className="mt-1 text-[10px] leading-relaxed text-muted">{body}</p>
            </div>
          ))}
        </div>
        <Badge variant="neutral" className="mt-3">Heuristic · not a mandate</Badge>
      </Panel>

      <Disclosure>Recurring detection is a sandbox heuristic. It does not create, cancel or predict real payments.</Disclosure>
    </div>
  );
}
