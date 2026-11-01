import Link from "next/link";
import { BookOpenCheck, Sparkles, Target, Wallet } from "lucide-react";
import { getDb } from "@/db/client";
import { requireUser } from "@/lib/auth";
import { getGoals, listAccounts } from "@/server/finance";
import { PageHeader, SandboxNote, Panel, Stat, Disclosure, EmptyState } from "@/components/ui/misc";
import { Money } from "@/components/ui/money";
import { Button } from "@/components/ui/button";
import { GoalCard } from "@/components/app/goal-card";

export const metadata = { title: "Goals" };

export default async function GoalsPage() {
  const user = await requireUser("/app/goals");
  const db = getDb();
  const goals = getGoals(db, user.id);
  const accounts = listAccounts(db, "user", user.id);
  const totalTarget = goals.reduce((acc, goal) => acc + goal.targetMinor, 0);
  const totalSaved = goals.reduce((acc, goal) => acc + goal.currentMinor, 0);
  const completed = goals.filter((goal) => goal.progress >= 100).length;
  const currency = goals[0]?.currency ?? "USD";

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Personal · goals"
        title="Goals"
        description="Each goal is backed by a real wallet. Progress is the live ledger balance of that wallet, not a manually edited number."
        actions={<Button asChild variant="secondary" size="sm"><Link href="/app/accounts"><Wallet className="h-3.5 w-3.5" /> Wallets</Link></Button>}
      />
      <SandboxNote />

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label="Saved toward goals" value={<Money amountMinor={totalSaved} currency={currency} />} hint={`Across ${goals.length} goals`} icon={<Target className="h-4 w-4" />} />
        <Stat label="Combined target" value={<Money amountMinor={totalTarget} currency={currency} />} hint={`${totalTarget === 0 ? 0 : Math.round((totalSaved / totalTarget) * 100)}% funded`} icon={<Sparkles className="h-4 w-4" />} />
        <Stat label="Completed" value={completed} hint="Reached the target balance" icon={<BookOpenCheck className="h-4 w-4" />} />
      </section>

      {goals.length === 0 ? (
        <EmptyState title="No goals yet" description="Goals are seeded for Maya Chen in the demo dataset." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {goals.map((goal) => (
            <GoalCard key={goal.id} goal={goal} accounts={accounts} />
          ))}
        </div>
      )}

      <section className="grid gap-4 lg:grid-cols-2">
        <Panel title="How contributions work" description="A goal is not a separate currency">
          <ol className="space-y-3">
            {[
              ["Internal transfer", "A contribution is an internal ledger transfer from a funding wallet into the goal wallet."],
              ["No magic numbers", "The progress bar reads the goal wallet's liability balance directly."],
              ["Idempotent", "Each contribution creates its own idempotency key, so a double-click cannot double-fund."],
              ["Completion is derived", "When the balance reaches the target, the goal status flips to completed."],
            ].map(([title, body], index) => (
              <li key={title} className="flex gap-3">
                <span className="mono flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[9px] font-semibold text-muted">{index + 1}</span>
                <div><p className="text-[11.5px] font-semibold">{title}</p><p className="mt-0.5 text-[10.5px] leading-relaxed text-muted">{body}</p></div>
              </li>
            ))}
          </ol>
        </Panel>
        <Panel title="Goal wallets" description="Where the money actually sits">
          <div className="space-y-2.5">
            {goals.map((goal) => (
              <div key={goal.id} className="flex items-center gap-3 rounded-[9px] border border-border bg-surface px-3 py-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-soft text-teal"><Target className="h-3.5 w-3.5" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-semibold">{goal.name}</p>
                  <p className="text-[9px] text-subtle">{goal.accountName}</p>
                </div>
                <Money amountMinor={goal.currentMinor} currency={goal.currency} className="text-[11px] font-semibold" />
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <Disclosure>Goals are a sandbox planning feature. No interest, investment return or deposit protection is simulated.</Disclosure>
    </div>
  );
}
