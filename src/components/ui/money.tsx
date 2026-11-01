import { formatMoney, formatMoneyParts } from "@/domain/money";
import { cn } from "@/lib/utils";

export function Money({
  amountMinor,
  currency,
  className,
  signed = false,
  compact = false,
  showCurrency = false,
}: {
  amountMinor: number;
  currency: string;
  className?: string;
  signed?: boolean;
  compact?: boolean;
  showCurrency?: boolean;
}) {
  return (
    <span className={cn("amount", className)}>
      {formatMoney(amountMinor, currency, {
        signed,
        compact,
        currencyDisplay: showCurrency ? "code" : "narrowSymbol",
      })}
    </span>
  );
}

export function MoneyHero({
  amountMinor,
  currency,
  className,
}: {
  amountMinor: number;
  currency: string;
  className?: string;
}) {
  const parts = formatMoneyParts(amountMinor, currency);
  return (
    <span className={cn("amount inline-flex items-baseline gap-1", className)}>
      <span className="text-[0.62em] font-semibold text-muted">{parts.symbol}</span>
      <span>
        {parts.negative ? "−" : ""}
        {parts.integer}
      </span>
      {parts.fraction ? (
        <span className="text-[0.48em] font-semibold text-muted">.{parts.fraction}</span>
      ) : null}
    </span>
  );
}

export function MoneyDelta({
  amountMinor,
  currency,
  className,
}: {
  amountMinor: number;
  currency: string;
  className?: string;
}) {
  const positive = amountMinor >= 0;
  return (
    <span
      className={cn(
        "amount inline-flex items-center gap-1 text-[12px] font-semibold",
        positive ? "text-success" : "text-danger",
        className,
      )}
    >
      {positive ? "▲" : "▼"} {formatMoney(Math.abs(amountMinor), currency, { compact: true })}
    </span>
  );
}

export function BalanceLabel({
  label,
  amountMinor,
  currency,
  hint,
  className,
}: {
  label: string;
  amountMinor: number;
  currency: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-subtle">{label}</p>
      <Money amountMinor={amountMinor} currency={currency} className="text-[17px] font-semibold" />
      {hint ? <p className="text-[11px] text-muted">{hint}</p> : null}
    </div>
  );
}
