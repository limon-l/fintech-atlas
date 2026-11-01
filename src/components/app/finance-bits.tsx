import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Briefcase,
  Car,
  Clapperboard,
  CreditCard,
  Dumbbell,
  GraduationCap,
  HeartPulse,
  Home,
  Monitor,
  Package,
  Plane,
  RefreshCw,
  ShoppingBag,
  Utensils,
  Wallet,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { AccountView, TransactionView } from "@/server/finance";
import { Badge, StatusPill } from "@/components/ui/badge";
import { Money } from "@/components/ui/money";
import { cn, formatDate, relativeTime } from "@/lib/utils";

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Groceries: ShoppingBag,
  Dining: Utensils,
  Transport: Car,
  Housing: Home,
  Utilities: Zap,
  Health: HeartPulse,
  Entertainment: Clapperboard,
  Travel: Plane,
  Shopping: ShoppingBag,
  Subscriptions: RefreshCw,
  Income: Banknote,
  Transfers: ArrowUpRight,
  Savings: Wallet,
  Software: Monitor,
  Office: Briefcase,
  Equipment: Package,
  Learning: GraduationCap,
  Infrastructure: Monitor,
  Vendors: Briefcase,
  Revenue: ArrowDownLeft,
  Other: CreditCard,
};

export function CategoryIcon({ category, className }: { category: string; className?: string }) {
  const Icon = CATEGORY_ICONS[category] ?? Dumbbell;
  return <Icon className={cn("h-4 w-4", className)} />;
}

export function AccountTile({ account, className }: { account: AccountView; className?: string }) {
  const accent =
    account.currency === "USD"
      ? "from-primary/90 to-[#1a398d]"
      : account.currency === "EUR"
        ? "from-teal/90 to-[#06625e]"
        : account.currency === "GBP"
          ? "from-violet/90 to-[#4d35a8]"
          : "from-[#3d7fa6] to-[#245a7a]";
  return (
    <Link
      href={`/app/accounts/${account.id}`}
      className={cn(
        "group relative flex flex-col justify-between overflow-hidden rounded-[15px] border border-border bg-surface p-4 transition-all hover:-translate-y-0.5 hover:border-border-strong hover:shadow-float",
        className,
      )}
    >
      <div className={cn("absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r", accent)} />
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11.5px] font-semibold">{account.name}</p>
          <p className="mono mt-0.5 text-[9.5px] text-subtle">{account.masked ?? account.iban ?? account.id}</p>
        </div>
        <Badge variant={account.currency === "USD" ? "primary" : account.currency === "EUR" ? "teal" : "violet"} className="!px-1.5 !py-0.5 !text-[8.5px]">
          {account.currency}
        </Badge>
      </div>
      <div className="mt-5">
        <Money amountMinor={account.ledgerMinor} currency={account.currency} className="text-[19px] font-semibold" />
        <div className="mt-1 flex items-center gap-2 text-[9.5px] text-subtle">
          <span>{account.kind}</span>
          {account.heldMinor > 0 ? (
            <>
              <span>·</span>
              <span className="text-warning">
                <Money amountMinor={account.heldMinor} currency={account.currency} compact /> held
              </span>
            </>
          ) : null}
        </div>
      </div>
      <ArrowUpRight className="absolute bottom-4 right-4 h-3.5 w-3.5 text-subtle opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  );
}

export function TransactionRow({
  transaction,
  showAccount = false,
}: {
  transaction: TransactionView;
  showAccount?: boolean;
}) {
  const credit = transaction.direction === "credit";
  return (
    <Link
      href={`/app/transactions/${transaction.id}`}
      className="group flex items-center gap-3 rounded-[9px] px-2 py-2.5 transition-colors hover:bg-surface-2/70"
    >
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          credit ? "bg-success-soft text-success" : "bg-surface-2 text-muted",
        )}
      >
        <CategoryIcon category={transaction.category} className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-[11.5px] font-semibold">
            {transaction.merchant ?? transaction.description}
          </p>
          {transaction.status !== "posted" ? <StatusPill status={transaction.status} className="!px-1.5 !py-0.5 !text-[8px]" /> : null}
        </div>
        <p className="mt-0.5 truncate text-[9.5px] text-subtle">
          {showAccount ? `${transaction.accountName} · ` : ""}
          {transaction.category} · {relativeTime(transaction.occurredAt)}
        </p>
      </div>
      <div className="text-right">
        <Money
          amountMinor={credit ? transaction.amountMinor : -transaction.amountMinor}
          currency={transaction.currency}
          signed
          className={cn("text-[11.5px] font-semibold", credit ? "text-success" : "text-foreground")}
        />
        <p className="mono mt-0.5 text-[8.5px] uppercase tracking-[0.06em] text-subtle">{transaction.currency}</p>
      </div>
    </Link>
  );
}

export function CategoryPill({ category }: { category: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[9.5px] font-medium text-muted">
      <CategoryIcon category={category} className="h-2.5 w-2.5" />
      {category}
    </span>
  );
}

export function TransactionDateGroup({ date }: { date: string }) {
  return (
    <p className="px-2 pb-1 pt-3 text-[9px] font-semibold uppercase tracking-[0.14em] text-subtle">
      {formatDate(date, { weekday: "long", day: "numeric", month: "long" })}
    </p>
  );
}
