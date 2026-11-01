"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Clock,
  Globe2,
  Landmark,
  Loader2,
  Lock,
  RefreshCw,
  Send,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";
import type { AccountView } from "@/server/finance";
import type { CreateQuoteResult } from "@/server/transfers";
import { requestQuoteAction, submitTransferAction } from "@/app/actions/transfers";
import { formatMoney, formatRate, parseMoneyToMinor } from "@/domain/money";
import { Button } from "@/components/ui/button";
import { Input, Field, Select, Textarea, FormError } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Money } from "@/components/ui/money";
import { InlineAlert } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

type Mode = "internal" | "external" | "fx";

interface BeneficiaryOption {
  id: string;
  name: string;
  type: string;
  currency: string;
  bankName: string | null;
  masked: string | null;
  linkedAccountId: string | null;
}

const MODES: Array<{ id: Mode; label: string; description: string; icon: typeof Send }> = [
  { id: "internal", label: "Between accounts", description: "Instant, same currency", icon: Wallet },
  { id: "external", label: "External payout", description: "Bank or wallet beneficiary", icon: Landmark },
  { id: "fx", label: "Convert FX", description: "Into another Atlas wallet", icon: Globe2 },
];

function externalFee(amountMinor: number): number {
  return Math.max(100, Math.round((amountMinor * 25) / 10_000));
}

function defaultRoute(
  mode: Mode,
  sourceId: string,
  accounts: AccountView[],
  beneficiaries: BeneficiaryOption[],
): { destinationId: string; beneficiaryId: string; targetCurrency: string } {
  const source = accounts.find((account) => account.id === sourceId) ?? accounts[0];
  const currency = source?.currency ?? "USD";
  if (mode === "internal") {
    const own = accounts.find((account) => account.id !== sourceId && account.currency === currency);
    const peer = beneficiaries.find((beneficiary) => beneficiary.type === "internal" && beneficiary.linkedAccountId);
    return { destinationId: own?.id ?? peer?.linkedAccountId ?? "", beneficiaryId: "", targetCurrency: "" };
  }
  if (mode === "external") {
    const external = beneficiaries.find((beneficiary) => beneficiary.type !== "internal" && beneficiary.currency === currency);
    return { destinationId: "", beneficiaryId: external?.id ?? "", targetCurrency: "" };
  }
  const target = accounts.find((account) => account.id !== sourceId && account.currency !== currency);
  return { destinationId: target?.id ?? "", beneficiaryId: "", targetCurrency: target?.currency ?? "" };
}

export function TransferComposer({
  accounts,
  beneficiaries,
  initialFrom,
  initialMode,
}: {
  accounts: AccountView[];
  beneficiaries: BeneficiaryOption[];
  initialFrom?: string;
  initialMode?: Mode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const initialSourceId = initialFrom ?? accounts[0]?.id ?? "";
  const initialRoute = defaultRoute(initialMode ?? "internal", initialSourceId, accounts, beneficiaries);
  const [mode, setMode] = useState<Mode>(initialMode ?? "internal");
  const [sourceId, setSourceId] = useState(initialSourceId);
  const [destinationId, setDestinationId] = useState(initialRoute.destinationId);
  const [beneficiaryId, setBeneficiaryId] = useState(initialRoute.beneficiaryId);
  const [targetCurrency, setTargetCurrency] = useState(initialRoute.targetCurrency);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [pin, setPin] = useState("");
  const [quote, setQuote] = useState<CreateQuoteResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quotePending, setQuotePending] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const keyRef = useRef<string>("");

  const source = accounts.find((account) => account.id === sourceId) ?? accounts[0];
  const currency = source?.currency ?? "USD";

  const ownTargets = useMemo(
    () => accounts.filter((account) => account.id !== sourceId && account.currency === currency),
    [accounts, sourceId, currency],
  );
  const fxTargets = useMemo(
    () => accounts.filter((account) => account.id !== sourceId && account.currency !== currency),
    [accounts, sourceId, currency],
  );
  const internalBeneficiaries = beneficiaries.filter((beneficiary) => beneficiary.type === "internal" && beneficiary.linkedAccountId);
  const externalBeneficiaries = beneficiaries.filter(
    (beneficiary) => beneficiary.type !== "internal" && beneficiary.currency === currency,
  );

  useEffect(() => {
    if (!keyRef.current) keyRef.current = crypto.randomUUID();
  }, []);

  function applyRoute(nextMode: Mode, nextSourceId: string) {
    const route = defaultRoute(nextMode, nextSourceId, accounts, beneficiaries);
    setDestinationId(route.destinationId);
    setBeneficiaryId(route.beneficiaryId);
    setTargetCurrency(route.targetCurrency);
    setQuote(null);
    setError(null);
  }

  function changeMode(nextMode: Mode) {
    setMode(nextMode);
    applyRoute(nextMode, sourceId);
  }

  function changeSource(nextSourceId: string) {
    setSourceId(nextSourceId);
    applyRoute(mode, nextSourceId);
  }

  useEffect(() => {
    if (!quote) return;
    const tick = () => {
      const left = Math.max(0, Math.floor((new Date(quote.expiresAt).getTime() - Date.now()) / 1000));
      setSecondsLeft(left);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [quote]);

  const amountMinor = (() => {
    try {
      return amount ? parseMoneyToMinor(amount, currency) : 0;
    } catch {
      return 0;
    }
  })();
  const fee = mode === "external" ? externalFee(amountMinor) : 0;
  const available = source?.availableMinor ?? 0;

  const destinationName = (() => {
    if (mode === "internal") {
      const account = ownTargets.find((row) => row.id === destinationId);
      if (account) return account.name;
      return internalBeneficiaries.find((row) => row.linkedAccountId === destinationId)?.name ?? "Choose destination";
    }
    if (mode === "external") return externalBeneficiaries.find((row) => row.id === beneficiaryId)?.name ?? "Choose beneficiary";
    return fxTargets.find((row) => row.currency === targetCurrency)?.name ?? "Choose wallet";
  })();

  const quoteStale = !quote || secondsLeft <= 0;

  function handleQuote() {
    setError(null);
    setQuotePending(true);
    startTransition(async () => {
      const result = await requestQuoteAction({ sourceAccountId: sourceId, targetCurrency, amount });
      setQuotePending(false);
      if (!result.ok || !result.data) {
        setError(result.error ?? "Could not create a quote.");
        return;
      }
      setQuote(result.data);
      const destination = fxTargets.find((row) => row.currency === targetCurrency);
      setDestinationId(destination?.id ?? "");
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (mode === "fx" && quoteStale) {
      setError("Request a fresh FX quote before submitting.");
      return;
    }
    if (mode === "internal" && !destinationId) {
      setError("Choose a destination account.");
      return;
    }
    if (mode === "external" && !beneficiaryId) {
      setError("Choose a beneficiary.");
      return;
    }
    if (!pin.trim()) {
      setError("Enter your authorization PIN.");
      return;
    }
    if (!keyRef.current) keyRef.current = crypto.randomUUID();
    startTransition(async () => {
      const result = await submitTransferAction({
        direction: mode,
        sourceAccountId: sourceId,
        amount,
        destinationAccountId: mode === "internal" || mode === "fx" ? destinationId : undefined,
        beneficiaryId: mode === "external" ? beneficiaryId : undefined,
        targetCurrency: mode === "fx" ? targetCurrency : undefined,
        quoteId: mode === "fx" ? quote?.id : undefined,
        note,
        pin,
        idempotencyKey: keyRef.current,
      });
      if (!result.ok || !result.data) {
        setError(result.error ?? "The transfer could not be created.");
        return;
      }
      router.push(`/app/transfers/${result.data.transferId}`);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 xl:grid-cols-[1.25fr_1fr]">
      <div className="space-y-4">
        <div className="surface-card p-4 sm:p-5">
          <p className="eyebrow mb-3">Route</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {MODES.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => changeMode(item.id)}
                className={cn(
                  "flex items-start gap-2.5 rounded-[11px] border p-3 text-left transition-all",
                  mode === item.id
                    ? "border-primary bg-primary-soft/60 shadow-soft"
                    : "border-border bg-surface hover:border-border-strong",
                )}
                aria-pressed={mode === item.id}
              >
                <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px]", mode === item.id ? "bg-primary text-primary-fg" : "bg-surface-2 text-muted")}>
                  <item.icon className="h-3.5 w-3.5" />
                </span>
                <span>
                  <span className="block text-[11px] font-semibold">{item.label}</span>
                  <span className="mt-0.5 block text-[9.5px] leading-snug text-muted">{item.description}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="surface-card space-y-4 p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="From" htmlFor="source">
              <Select id="source" value={sourceId} onChange={(event) => changeSource(event.target.value)}>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} · {account.currency} · {formatMoney(account.availableMinor, account.currency)} available
                  </option>
                ))}
              </Select>
            </Field>

            {mode === "internal" ? (
              <Field label="To" htmlFor="destination">
                <Select id="destination" value={destinationId} onChange={(event) => setDestinationId(event.target.value)}>
                  <optgroup label="Your accounts">
                    {ownTargets.map((account) => (
                      <option key={account.id} value={account.id}>{account.name} · {account.currency}</option>
                    ))}
                  </optgroup>
                  {internalBeneficiaries.length > 0 ? (
                    <optgroup label="Atlas peers">
                      {internalBeneficiaries.map((beneficiary) => (
                        <option key={beneficiary.id} value={beneficiary.linkedAccountId ?? ""}>{beneficiary.name}</option>
                      ))}
                    </optgroup>
                  ) : null}
                </Select>
              </Field>
            ) : null}

            {mode === "external" ? (
              <Field label="Beneficiary" htmlFor="beneficiary" hint={externalBeneficiaries.length === 0 ? `No ${currency} beneficiary saved yet.` : undefined}>
                <Select id="beneficiary" value={beneficiaryId} onChange={(event) => setBeneficiaryId(event.target.value)}>
                  {externalBeneficiaries.length === 0 ? <option value="">No eligible beneficiary</option> : null}
                  {externalBeneficiaries.map((beneficiary) => (
                    <option key={beneficiary.id} value={beneficiary.id}>
                      {beneficiary.name} · {beneficiary.bankName ?? "wallet"} · {beneficiary.masked ?? ""}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}

            {mode === "fx" ? (
              <Field label="Into currency" htmlFor="targetCurrency">
                <Select
                  id="targetCurrency"
                  value={targetCurrency}
                  onChange={(event) => {
                    setTargetCurrency(event.target.value);
                    setDestinationId(fxTargets.find((row) => row.currency === event.target.value)?.id ?? "");
                    setQuote(null);
                  }}
                >
                  {fxTargets.length === 0 ? <option value="">No other wallets</option> : null}
                  {fxTargets.map((account) => (
                    <option key={account.id} value={account.currency}>{account.currency} · {account.name}</option>
                  ))}
                </Select>
              </Field>
            ) : null}
          </div>

          <Field
            label={`Amount (${currency})`}
            htmlFor="amount"
            hint={
              source ? (
                <>
                  Available <Money amountMinor={available} currency={currency} /> · <Money amountMinor={source.heldMinor} currency={currency} /> held
                </>
              ) : undefined
            }
          >
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12px] font-semibold text-muted">{currency}</span>
              <Input
                id="amount"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(event) => {
                  setAmount(event.target.value);
                  if (mode === "fx") setQuote(null);
                }}
                className="amount pl-14 text-[16px] font-semibold"
                autoComplete="off"
              />
              {source ? (
                <button
                  type="button"
                  onClick={() => setAmount((available / 100).toFixed(2))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-[6px] px-2 py-1 text-[9px] font-semibold text-primary hover:bg-primary-soft"
                >
                  MAX
                </button>
              ) : null}
            </div>
          </Field>

          <Field label="Reference (optional)" htmlFor="note">
            <Textarea id="note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="What is this payment for?" className="min-h-[70px]" maxLength={140} />
          </Field>

          {mode === "fx" ? (
            <div className="rounded-[11px] border border-border bg-surface-2/50 p-3.5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-subtle">FX quote</p>
                  <p className="mt-1 text-[11px] text-muted">
                    {quote ? `${formatRate(quote.rate, quote.fromCurrency, quote.toCurrency)} · expires in ${secondsLeft}s` : "Quotes are valid for 90 seconds."}
                  </p>
                </div>
                <Button type="button" variant="secondary" size="sm" onClick={handleQuote} disabled={quotePending || !amount || !targetCurrency}>
                  {quotePending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : quote ? <RefreshCw className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                  {quote ? "Refresh" : "Get quote"}
                </Button>
              </div>
              {quote ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-[8px] bg-surface px-2.5 py-2">
                    <p className="text-[8.5px] uppercase tracking-[0.1em] text-subtle">You convert</p>
                    <Money amountMinor={quote.sourceAmountMinor} currency={quote.fromCurrency} className="mt-0.5 block text-[11px] font-semibold" />
                  </div>
                  <div className="rounded-[8px] bg-surface px-2.5 py-2">
                    <p className="text-[8.5px] uppercase tracking-[0.1em] text-subtle">Fee</p>
                    <Money amountMinor={quote.feeMinor} currency={quote.fromCurrency} className="mt-0.5 block text-[11px] font-semibold" />
                  </div>
                  <div className="rounded-[8px] bg-surface px-2.5 py-2">
                    <p className="text-[8.5px] uppercase tracking-[0.1em] text-subtle">You receive</p>
                    <Money amountMinor={quote.targetAmountMinor} currency={quote.toCurrency} className="mt-0.5 block text-[11px] font-semibold text-teal" />
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="surface-card space-y-3 p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <Lock className="h-3.5 w-3.5 text-primary" />
            <p className="text-[12px] font-semibold">Step-up authorization</p>
            <Badge variant="neutral" className="ml-auto !text-[8.5px]">Demo PIN 246810</Badge>
          </div>
          <Field label="Authorization PIN" htmlFor="pin" hint="Required for every outbound movement. Verified server-side with rate limiting.">
            <Input
              id="pin"
              type="password"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={pin}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))}
              placeholder="••••••"
              className="mono tracking-[0.4em]"
            />
          </Field>
          {error ? <FormError message={error} /> : null}
          <Button type="submit" className="w-full" size="lg" disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {pending ? "Submitting…" : mode === "fx" ? "Convert and post" : "Authorize transfer"}
          </Button>
          <p className="text-center text-[9.5px] leading-relaxed text-subtle">
            Submitting claims a unique idempotency key. Retries return the original transfer rather than paying twice.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="surface-card p-4 sm:p-5">
          <p className="eyebrow mb-3">Review</p>
          <dl className="space-y-2.5 text-[11px]">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted">From</dt>
              <dd className="text-right font-semibold">{source?.name}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted">To</dt>
              <dd className="text-right font-semibold">{destinationName}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted">Amount</dt>
              <dd className="text-right font-semibold"><Money amountMinor={amountMinor} currency={currency} /></dd>
            </div>
            {mode === "external" ? (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted">Network fee</dt>
                <dd className="text-right font-semibold"><Money amountMinor={fee} currency={currency} /></dd>
              </div>
            ) : null}
            {mode === "fx" && quote ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted">FX fee</dt>
                  <dd className="text-right font-semibold"><Money amountMinor={quote.feeMinor} currency={quote.fromCurrency} /></dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted">Recipient receives</dt>
                  <dd className="text-right font-semibold text-teal"><Money amountMinor={quote.targetAmountMinor} currency={quote.toCurrency} /></dd>
                </div>
              </>
            ) : null}
            <div className="flex items-center justify-between gap-3 border-t border-border pt-2.5">
              <dt className="font-semibold">Total debit</dt>
              <dd className="text-right"><Money amountMinor={amountMinor + (mode === "external" ? fee : 0)} currency={currency} className="text-[13px] font-semibold" /></dd>
            </div>
          </dl>
          <div className="mt-3 flex items-start gap-2 rounded-[9px] bg-surface-2/60 px-3 py-2.5">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
            <p className="text-[9.5px] leading-relaxed text-muted">
              {mode === "external"
                ? "Funds are held immediately. The ledger posts only when settlement arrives."
                : mode === "fx"
                  ? "Two balanced journals convert value into the destination wallet. External FX payouts are disabled."
                  : "Instant internal settlement. Both accounts post inside one balanced journal."}
            </p>
          </div>
        </div>

        <div className="surface-card p-4 sm:p-5">
          <p className="eyebrow mb-2.5">Available now</p>
          <div className="space-y-2">
            {accounts.map((account) => (
              <div key={account.id} className={cn("flex items-center justify-between gap-2 rounded-[8px] px-2 py-1.5", account.id === sourceId && "bg-primary-soft/50")}>
                <span className="flex items-center gap-2 text-[10.5px]">
                  {account.id === sourceId ? <Check className="h-3 w-3 text-primary" /> : <Wallet className="h-3 w-3 text-subtle" />}
                  {account.name}
                </span>
                <Money amountMinor={account.availableMinor} currency={account.currency} className="text-[10.5px] font-semibold" />
              </div>
            ))}
          </div>
          {beneficiaries.length === 0 ? (
            <Link href="/app/beneficiaries" className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-semibold text-primary hover:underline">
              <Users className="h-3 w-3" /> Add a beneficiary first
            </Link>
          ) : null}
        </div>

        {amountMinor > available && amountMinor > 0 ? (
          <InlineAlert tone="warning" title="Insufficient available balance">
            Reduce the amount or move funds into {source?.name} first. Held funds are not spendable.
          </InlineAlert>
        ) : null}

        <div className="rounded-[12px] border border-border bg-surface-2/40 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-subtle">Sandbox routing</p>
          <p className="mt-1.5 text-[10.5px] leading-relaxed text-muted">
            {mode === "external"
              ? "Simulated payout network. No real bank is contacted and no real money moves."
              : mode === "fx"
                ? "Synthetic reference rates. Production requires a licensed, timestamped rate provider."
                : "Both wallets belong to the sandbox ledger."}
          </p>
        </div>
      </div>
    </form>
  );
}
