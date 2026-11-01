"use client";

import { useActionState, useEffect, useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import type { BudgetView } from "@/server/finance";
import { updateBudgetAction, type ActionState } from "@/app/actions/personal";
import { Input } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { ProgressBar } from "@/components/ui/misc";
import { CategoryIcon } from "@/components/app/finance-bits";
import { minorToDecimalString } from "@/domain/money";
import { cn } from "@/lib/utils";

const initial: ActionState = {};

function CategoryRow({
  category,
  currency,
}: {
  category: BudgetView["categories"][number];
  currency: string;
}) {
  const [state, action, pending] = useActionState(updateBudgetAction, initial);
  const [editing, setEditing] = useState(false);
  const [limit, setLimit] = useState(minorToDecimalString(category.limitMinor, currency));

  useEffect(() => {
    if (state.message) {
      toast.success(state.message);
    }
    if (state.error) toast.error(state.error);
  }, [state]);

  const remaining = category.limitMinor - category.spentMinor;
  const tone = category.utilization > 100 ? "danger" : category.utilization > 80 ? "warning" : "primary";

  return (
    <div className="rounded-[10px] border border-border bg-surface px-3 py-3">
      <div className="flex items-center gap-2.5">
        <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", category.utilization > 100 ? "bg-danger-soft text-danger" : "bg-surface-2 text-muted")}>
          <CategoryIcon category={category.category} className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11.5px] font-semibold">{category.category}</p>
            <span className="mono text-[9.5px] text-subtle">{category.utilization}%</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-[9.5px] text-muted">
            <span><Money amountMinor={category.spentMinor} currency={currency} compact /> spent</span>
            <span>of <Money amountMinor={category.limitMinor} currency={currency} compact /></span>
          </div>
        </div>
        <Button type="button" variant="ghost" size="icon-sm" onClick={() => setEditing((value) => !value)} aria-label={`Edit ${category.category} limit`}>
          {editing ? <X className="h-3.5 w-3.5" /> : <Pencil className="h-3 w-3" />}
        </Button>
      </div>
      <ProgressBar value={category.utilization} tone={tone} className="mt-2 h-1.5" />
      <p className={cn("mt-1 text-[9px]", remaining < 0 ? "text-danger" : "text-subtle")}>
        {remaining < 0 ? "Over by " : "Remaining "}
        <Money amountMinor={Math.abs(remaining)} currency={currency} />
      </p>

      {editing ? (
        <form action={action} className="mt-2.5 flex items-center gap-2">
          <input type="hidden" name="categoryId" value={category.id} />
          <Input name="limit" value={limit} onChange={(event) => setLimit(event.target.value)} inputMode="decimal" className="h-8 flex-1 text-[12px]" aria-label={`${category.category} limit`} />
          <Button type="submit" size="sm" disabled={pending}><Check className="h-3.5 w-3.5" /> Save</Button>
        </form>
      ) : null}
    </div>
  );
}

export function BudgetEditor({ budget }: { budget: BudgetView }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {budget.categories.map((category) => (
        <CategoryRow key={category.id} category={category} currency={budget.currency} />
      ))}
    </div>
  );
}
