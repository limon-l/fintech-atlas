import { ArrowDownLeft, ArrowUpRight, Check, Circle, Clock } from "lucide-react";
import { Money } from "@/components/ui/money";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface PostingView {
  id?: string;
  ledgerCode?: string;
  ledgerName: string;
  type?: string;
  currency: string;
  amountMinor: number;
  side: "debit" | "credit";
  isCustomer?: boolean;
}

export function PostingsTable({
  postings,
  compact = false,
  className,
}: {
  postings: PostingView[];
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-border/70 text-[9px] uppercase tracking-[0.1em] text-subtle">
            <th className="py-2 pr-3 font-semibold">Ledger account</th>
            <th className="px-3 py-2 font-semibold">Side</th>
            <th className="py-2 pl-3 text-right font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {postings.map((posting, index) => (
            <tr key={posting.id ?? `${posting.ledgerName}-${index}`} className="border-b border-border/40 last:border-0">
              <td className="py-2.5 pr-3">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                      posting.side === "debit" ? "bg-info-soft text-info" : "bg-teal-soft text-teal",
                    )}
                  >
                    {posting.side === "debit" ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownLeft className="h-2.5 w-2.5" />}
                  </span>
                  <div className="min-w-0">
                    <p className={cn("truncate font-medium", compact ? "text-[10.5px]" : "text-[11.5px]")}>
                      {posting.ledgerName}
                    </p>
                    <p className="mono truncate text-[8.5px] text-subtle">
                      {posting.ledgerCode ?? posting.type ?? "ledger"}
                      {posting.isCustomer ? " · customer liability" : ""}
                    </p>
                  </div>
                </div>
              </td>
              <td className="px-3 py-2.5">
                <Badge variant={posting.side === "debit" ? "info" : "teal"} className="!px-1.5 !py-0.5 !text-[8px] uppercase">
                  {posting.side}
                </Badge>
              </td>
              <td className="py-2.5 pl-3 text-right">
                <Money
                  amountMinor={posting.side === "debit" ? posting.amountMinor : -posting.amountMinor}
                  currency={posting.currency}
                  signed
                  className={cn("font-semibold", compact ? "text-[10.5px]" : "text-[11.5px]")}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function BalanceCheck({ postings }: { postings: PostingView[] }) {
  const byCurrency = new Map<string, number>();
  for (const posting of postings) {
    const signed = posting.side === "debit" ? posting.amountMinor : -posting.amountMinor;
    byCurrency.set(posting.currency, (byCurrency.get(posting.currency) ?? 0) + signed);
  }
  const currencies = [...byCurrency.entries()];
  const balanced = currencies.every(([, total]) => total === 0);
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-[9px] border px-3 py-2 text-[10.5px]",
        balanced ? "border-success/25 bg-success-soft text-success" : "border-danger/25 bg-danger-soft text-danger",
      )}
    >
      <span className="inline-flex items-center gap-1.5 font-semibold">
        {balanced ? <Check className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
        {balanced ? "Journal balances to zero" : "Journal is unbalanced"}
      </span>
      {currencies.map(([currency, total]) => (
        <span key={currency} className="mono text-[9.5px] opacity-80">
          {currency} net <Money amountMinor={total} currency={currency} signed />
        </span>
      ))}
    </div>
  );
}

export interface TimelineStep {
  key: string;
  label: string;
  detail: string;
  at: string | null;
  state: "complete" | "current" | "pending";
}

export function Timeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <ol className="space-y-0">
      {steps.map((step, index) => {
        const last = index === steps.length - 1;
        return (
          <li key={step.key} className="relative flex gap-3 pb-4 last:pb-0">
            {!last ? (
              <span
                className={cn(
                  "absolute left-[9px] top-5 h-[calc(100%-12px)] w-px",
                  step.state === "complete" ? "bg-success/40" : "bg-border",
                )}
                aria-hidden="true"
              />
            ) : null}
            <span
              className={cn(
                "relative z-10 mt-0.5 flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full border",
                step.state === "complete"
                  ? "border-success/40 bg-success-soft text-success"
                  : step.state === "current"
                    ? "border-primary/40 bg-primary-soft text-primary"
                    : "border-border bg-surface-2 text-subtle",
              )}
            >
              {step.state === "complete" ? (
                <Check className="h-2.5 w-2.5" strokeWidth={3} />
              ) : step.state === "current" ? (
                <Clock className="h-2.5 w-2.5" />
              ) : (
                <span className="h-1 w-1 rounded-full bg-current" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className={cn("text-[11.5px] font-semibold", step.state === "pending" && "text-muted")}>{step.label}</p>
                {step.at ? (
                  <span className="mono text-[8.5px] text-subtle">{new Date(step.at).toLocaleString("en-GB")}</span>
                ) : null}
              </div>
              <p className="mt-0.5 text-[10.5px] leading-relaxed text-muted">{step.detail}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
