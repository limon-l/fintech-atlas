"use client";

import { useActionState, useEffect, useState } from "react";
import { ArrowRight, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import type { AccountView, GoalView } from "@/server/finance";
import { contributeGoalAction, type ActionState } from "@/app/actions/personal";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, FormError } from "@/components/ui/form";
import { Money } from "@/components/ui/money";
import { ProgressBar } from "@/components/ui/misc";
import { formatDate } from "@/lib/utils";

const initial: ActionState = {};

export function GoalCard({ goal, accounts }: { goal: GoalView; accounts: AccountView[] }) {
  const [state, action, pending] = useActionState(contributeGoalAction, initial);
  const [open, setOpen] = useState(false);
  const funding = accounts.filter((account) => account.id !== goal.accountId && account.status === "active");
  const [source, setSource] = useState(funding[0]?.id ?? "");
  const [amount, setAmount] = useState("");

  useEffect(() => {
    if (state.message) {
      toast.success(state.message);
    }
    if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <div className="surface-card overflow-hidden">
      <div className="border-b border-border/70 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[13px] font-semibold">{goal.name}</p>
            <p className="mt-0.5 text-[10px] text-muted">Target {formatDate(goal.targetDate)} · {goal.accountName}</p>
          </div>
          <span className={`mono text-[11px] font-semibold ${goal.progress >= 100 ? "text-success" : "text-teal"}`}>{goal.progress}%</span>
        </div>
        <ProgressBar value={goal.progress} tone={goal.progress >= 100 ? "success" : "teal"} className="mt-3 h-2" />
        <div className="mt-2 flex items-end justify-between">
          <Money amountMinor={goal.currentMinor} currency={goal.currency} className="text-[20px] font-semibold" />
          <span className="text-[10px] text-muted">of <Money amountMinor={goal.targetMinor} currency={goal.currency} compact /></span>
        </div>
      </div>
      <div className="px-5 py-4">
        <div className="flex items-center justify-between text-[10px] text-muted">
          <span>Remaining</span>
          <Money amountMinor={Math.max(0, goal.targetMinor - goal.currentMinor)} currency={goal.currency} className="font-semibold" />
        </div>
        {goal.contributions.length > 0 ? (
          <div className="mt-3 space-y-1.5">
            <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-subtle">Recent contributions</p>
            {goal.contributions.slice(0, 4).map((contribution, index) => (
              <div key={`${contribution.createdAt}-${index}`} className="flex items-center justify-between text-[9.5px]">
                <span className="text-muted">{formatDate(contribution.createdAt)}</span>
                <Money amountMinor={contribution.amountMinor} currency={goal.currency} className="font-semibold" />
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-[10px] text-subtle">No contributions recorded yet.</p>
        )}

        {goal.status === "completed" ? (
          <div className="mt-3 rounded-[8px] bg-success-soft px-3 py-2 text-center text-[10px] font-semibold text-success">Goal completed</div>
        ) : open ? (
          <form action={action} className="mt-3 space-y-2.5 rounded-[10px] border border-border bg-surface-2/50 p-3">
            <input type="hidden" name="goalId" value={goal.id} />
            <Field label="Fund from" htmlFor={`source-${goal.id}`}>
              <Select id={`source-${goal.id}`} name="sourceAccountId" value={source} onChange={(event) => setSource(event.target.value)} className="h-9 text-[12px]">
                {funding.map((account) => (
                  <option key={account.id} value={account.id}>{account.name} · {account.currency}</option>
                ))}
              </Select>
            </Field>
            <Field label={`Amount (${goal.currency})`} htmlFor={`amount-${goal.id}`}>
              <Input id={`amount-${goal.id}`} name="amount" value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="0.00" className="h-9 text-[12px]" />
            </Field>
            {state.error ? <FormError message={state.error} /> : null}
            <div className="flex gap-2">
              <Button type="submit" size="sm" className="flex-1" disabled={pending}>
                {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />} Contribute
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            </div>
          </form>
        ) : (
          <Button type="button" variant="secondary" size="sm" className="mt-3 w-full" onClick={() => setOpen(true)} disabled={funding.length === 0}>
            <Plus className="h-3.5 w-3.5" /> Add contribution
          </Button>
        )}
      </div>
    </div>
  );
}
