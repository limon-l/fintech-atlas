"use client";

import { useActionState, useEffect, useState } from "react";
import { Lock, LockOpen, Settings2, ShieldCheck, Snowflake, Wifi } from "lucide-react";
import { toast } from "sonner";
import type { CardView } from "@/server/finance";
import { updateCardAction, type ActionState } from "@/app/actions/personal";
import { Button } from "@/components/ui/button";
import { Input, Field, FormError } from "@/components/ui/form";
import { Badge, StatusPill } from "@/components/ui/badge";
import { Money } from "@/components/ui/money";
import { ProgressBar, EmptyState } from "@/components/ui/misc";
import { CategoryIcon } from "@/components/app/finance-bits";
import { formatMoney, minorToDecimalString } from "@/domain/money";
import { cn, relativeTime } from "@/lib/utils";

const initial: ActionState = {};

function CardFace({ card, holder }: { card: CardView; holder: string }) {
  const frozen = card.status === "frozen";
  const gradient =
    card.kind === "physical"
      ? "from-[#101d33] via-[#173463] to-[#0d4b49]"
      : card.network === "Visa"
        ? "from-[#241a4d] via-[#3b2a78] to-[#121a3a]"
        : "from-[#0c2f38] via-[#14545b] to-[#0a1f2b]";
  return (
    <div className={cn("relative aspect-[1.62/1] w-full overflow-hidden rounded-[16px] bg-gradient-to-br p-4 text-white shadow-float transition-opacity", gradient, frozen && "opacity-70 saturate-50")}>
      <div className="absolute inset-0 atlas-dots opacity-[0.16]" />
      <div className="absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
      <div className="relative flex h-full flex-col justify-between">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[8px] font-semibold uppercase tracking-[0.18em] text-white/45">Atlas sandbox</p>
            <p className="mt-0.5 text-[12px] font-semibold">{card.label}</p>
          </div>
          <div className="flex items-center gap-2">
            {frozen ? <Snowflake className="h-4 w-4 text-white/70" /> : <Wifi className="h-4 w-4 rotate-90 text-white/60" />}
            <span className="text-[10px] font-bold tracking-[0.08em]">{card.network}</span>
          </div>
        </div>
        <div>
          <p className="mono text-[15px] tracking-[0.18em] text-white/90">•••• •••• •••• {card.last4}</p>
          <div className="mt-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-[7px] uppercase tracking-[0.14em] text-white/35">Cardholder</p>
              <p className="text-[9.5px] font-semibold uppercase tracking-[0.06em] text-white/80">{holder}</p>
            </div>
            <div className="text-right">
              <p className="text-[7px] uppercase tracking-[0.14em] text-white/35">Expires</p>
              <p className="mono text-[9.5px] text-white/80">09/29</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CardControls({ card, holder }: { card: CardView; holder: string }) {
  const [state, action, pending] = useActionState(updateCardAction, initial);
  const [editing, setEditing] = useState(false);
  const [monthly, setMonthly] = useState(minorToDecimalString(card.monthlyLimitMinor, card.currency));
  const [perTxn, setPerTxn] = useState(minorToDecimalString(card.perTxnLimitMinor, card.currency));

  useEffect(() => {
    if (state.message) toast.success(state.message);
    if (state.error) toast.error(state.error);
  }, [state]);

  const used = card.monthlyLimitMinor === 0 ? 0 : Math.round((card.spentThisMonthMinor / card.monthlyLimitMinor) * 100);

  return (
    <div className="surface-card overflow-hidden">
      <div className="p-4">
        <CardFace card={card} holder={holder} />
      </div>
      <div className="space-y-3 px-4 pb-4">
        <div className="flex items-center justify-between gap-2">
          <StatusPill status={card.status} />
          <Badge variant="neutral">{card.kind}</Badge>
        </div>

        <div>
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-muted">Spent this month</span>
            <span className="mono text-[9.5px] text-subtle">
              {formatMoney(card.spentThisMonthMinor, card.currency, { compact: true })} / {formatMoney(card.monthlyLimitMinor, card.currency, { compact: true })}
            </span>
          </div>
          <ProgressBar value={used} tone={used > 90 ? "danger" : used > 70 ? "warning" : "primary"} className="mt-1.5 h-1.5" />
          <p className="mt-1 text-[9px] text-subtle">Per transaction limit <Money amountMinor={card.perTxnLimitMinor} currency={card.currency} compact /></p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {card.allowedCategories.slice(0, 4).map((category) => (
            <span key={category} className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 px-1.5 py-0.5 text-[8.5px] text-muted">
              <CategoryIcon category={category} className="h-2 w-2" /> {category}
            </span>
          ))}
          {card.allowedCategories.length > 4 ? <span className="text-[8.5px] text-subtle">+{card.allowedCategories.length - 4}</span> : null}
        </div>

        <div className="flex gap-2">
          <form action={action} className="flex-1">
            <input type="hidden" name="cardId" value={card.id} />
            <input type="hidden" name="intent" value={card.status === "frozen" ? "unfreeze" : "freeze"} />
            <Button type="submit" variant={card.status === "frozen" ? "success" : "secondary"} size="sm" className="w-full" disabled={pending}>
              {card.status === "frozen" ? <LockOpen className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
              {card.status === "frozen" ? "Unfreeze" : "Freeze"}
            </Button>
          </form>
          <Button type="button" variant="outline" size="sm" onClick={() => setEditing((value) => !value)} aria-expanded={editing}>
            <Settings2 className="h-3.5 w-3.5" /> Limits
          </Button>
        </div>

        {editing ? (
          <form action={action} className="space-y-2.5 rounded-[10px] border border-border bg-surface-2/50 p-3">
            <input type="hidden" name="cardId" value={card.id} />
            <input type="hidden" name="intent" value="limits" />
            <div className="grid grid-cols-2 gap-2">
              <Field label={`Monthly ${card.currency}`} htmlFor={`monthly-${card.id}`}>
                <Input id={`monthly-${card.id}`} name="monthlyLimit" value={monthly} onChange={(event) => setMonthly(event.target.value)} inputMode="decimal" className="h-8 text-[12px]" />
              </Field>
              <Field label={`Per txn ${card.currency}`} htmlFor={`pertxn-${card.id}`}>
                <Input id={`pertxn-${card.id}`} name="perTxnLimit" value={perTxn} onChange={(event) => setPerTxn(event.target.value)} inputMode="decimal" className="h-8 text-[12px]" />
              </Field>
            </div>
            {state.error ? <FormError message={state.error} /> : null}
            <Button type="submit" size="sm" className="w-full" disabled={pending}>
              <ShieldCheck className="h-3.5 w-3.5" /> Save limits
            </Button>
          </form>
        ) : null}

        {card.recent.length > 0 ? (
          <div className="border-t border-border/60 pt-2.5">
            <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-subtle">Recent authorizations</p>
            <div className="space-y-1.5">
              {card.recent.slice(0, 3).map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between gap-2 text-[9.5px]">
                  <span className="truncate text-muted">{transaction.merchant ?? transaction.description}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-subtle">{relativeTime(transaction.occurredAt)}</span>
                    <Money amountMinor={transaction.direction === "credit" ? transaction.amountMinor : -transaction.amountMinor} currency={transaction.currency} signed className="font-semibold" />
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function CardStudio({ cards, holder }: { cards: CardView[]; holder: string }) {
  if (cards.length === 0) {
    return <EmptyState title="No cards issued" description="Virtual cards are issued to customer personas and to organization members with card access." />;
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => (
        <CardControls key={card.id} card={card} holder={holder} />
      ))}
    </div>
  );
}
