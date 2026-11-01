"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import type { AccountView } from "@/server/finance";
import type { CreateQuoteResult } from "@/server/transfers";
import { requestQuoteAction, submitTransferAction } from "@/app/actions/transfers";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { Money } from "@/components/ui/money";
import { formatRate, minorToDecimalString } from "@/domain/money";
import { cn } from "@/lib/utils";

export function FxConverter({ accounts }: { accounts: AccountView[] }) {
  const router = useRouter();
  const active = accounts.filter((account) => account.status === "active");
  const [sourceId, setSourceId] = useState(active[0]?.id ?? "");
  const [destinationId, setDestinationId] = useState(
    active.find((account) => account.id !== active[0]?.id)?.id ?? "",
  );
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<CreateQuoteResult | null>(null);
  const [pin, setPin] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [pending, startTransition] = useTransition();

  const source = active.find((account) => account.id === sourceId);
  const destination = active.find((account) => account.id === destinationId);
  const destinations = active.filter(
    (account) => account.id !== sourceId && account.currency !== source?.currency,
  );

  function resetQuote() {
    setQuote(null);
    setIdempotencyKey("");
    setPin("");
  }

  function requestQuote() {
    if (!source || !destination) {
      toast.error("Choose two wallets in different currencies.");
      return;
    }
    startTransition(async () => {
      const result = await requestQuoteAction({
        sourceAccountId: source.id,
        targetCurrency: destination.currency,
        amount,
      });
      if (!result.ok || !result.data) {
        toast.error(result.error ?? "Could not create a quote.");
        return;
      }
      setQuote(result.data);
      setIdempotencyKey(globalThis.crypto.randomUUID());
      toast.success("Indicative quote locked for 90 seconds.");
    });
  }

  function convert() {
    if (!quote || !source || !destination) return;
    if (pin.length !== 6) {
      toast.error("Enter your six-digit authorization PIN.");
      return;
    }
    startTransition(async () => {
      const result = await submitTransferAction({
        direction: "fx",
        sourceAccountId: source.id,
        destinationAccountId: destination.id,
        amount: minorToDecimalString(quote.sourceAmountMinor, quote.fromCurrency),
        targetCurrency: quote.toCurrency,
        quoteId: quote.id,
        note: "FX conversion",
        pin,
        idempotencyKey,
      });
      if (!result.ok || !result.data) {
        toast.error(result.error ?? "Conversion failed.");
        return;
      }
      toast.success(`Converted · ${result.data.reference}`);
      router.push(`/app/transfers/${result.data.transferId}`);
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
      <section className="surface-card p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="From wallet" htmlFor="fx-source">
            <Select
              id="fx-source"
              value={sourceId}
              onChange={(event) => {
                setSourceId(event.target.value);
                resetQuote();
                const next = active.find(
                  (account) => account.id !== event.target.value && account.currency !== active.find((a) => a.id === event.target.value)?.currency,
                );
                setDestinationId(next?.id ?? "");
              }}
            >
              {active.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} · {account.currency}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Into wallet" htmlFor="fx-destination" hint={destinations.length === 0 ? "No second-currency wallet available." : undefined}>
            <Select
              id="fx-destination"
              value={destinationId}
              onChange={(event) => {
                setDestinationId(event.target.value);
                resetQuote();
              }}
              disabled={destinations.length === 0}
            >
              {destinations.length === 0 ? <option value="">No eligible wallet</option> : null}
              {destinations.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} · {account.currency}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field
          label={`You convert (${source?.currency ?? "—"})`}
          htmlFor="fx-amount"
          className="mt-3"
          hint={source ? `Available ${minorToDecimalString(source.availableMinor, source.currency)} ${source.currency}` : undefined}
        >
          <Input
            id="fx-amount"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value);
              resetQuote();
            }}
          />
        </Field>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button type="button" onClick={requestQuote} disabled={pending || !source || !destination || !amount}>
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Get quote
          </Button>
          <Button asChild type="button" variant="ghost" size="sm">
            <Link href="/app/transfers/new?mode=fx">Open full transfer composer</Link>
          </Button>
        </div>

        <div className="mt-5 rounded-[11px] border border-border bg-surface-2/50 p-3.5 text-[11px] leading-relaxed text-muted">
          <p className="flex items-center gap-1.5 font-semibold text-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-success" /> Sandbox conversion rules
          </p>
          <p className="mt-1.5">
            FX converts between your own Atlas wallets only. External FX payouts are rejected. The quote
            locks an indicative rate for 90 seconds and the ledger posts a balanced journal per currency.
          </p>
        </div>
      </section>

      <section className="surface-card p-5">
        <h2 className="text-[14px] font-semibold tracking-tight">Quote preview</h2>
        <p className="mt-0.5 text-[12px] text-muted">Nothing is posted until you authorize with your PIN.</p>

        {!quote ? (
          <div className="mt-5 rounded-[12px] border border-dashed border-border-strong px-4 py-10 text-center">
            <p className="text-[12.5px] font-semibold">No active quote</p>
            <p className="mt-1 text-[11px] text-muted">Enter an amount and request a quote to see the rate, fee and target amount.</p>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="rounded-[12px] border border-border bg-surface-2/50 p-4">
              <div className="flex items-center justify-between gap-2 text-[12px]">
                <span className="text-muted">You send</span>
                <Money amountMinor={quote.sourceAmountMinor} currency={quote.fromCurrency} className="font-semibold" />
              </div>
              <div className="my-2 flex items-center justify-center text-subtle">
                <ArrowRight className="h-4 w-4" />
              </div>
              <div className="flex items-center justify-between gap-2 text-[12px]">
                <span className="text-muted">They receive</span>
                <Money amountMinor={quote.targetAmountMinor} currency={quote.toCurrency} className="text-[16px] font-semibold" />
              </div>
            </div>
            <dl className="divide-y divide-border/70 text-[11.5px]">
              <div className="flex justify-between py-2">
                <dt className="text-muted">Indicative rate</dt>
                <dd className="mono">{formatRate(quote.rate, quote.fromCurrency, quote.toCurrency)}</dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-muted">Effective rate</dt>
                <dd className="mono">{formatRate(quote.effectiveRate, quote.fromCurrency, quote.toCurrency)}</dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-muted">Fee</dt>
                <dd><Money amountMinor={quote.feeMinor} currency={quote.fromCurrency} /></dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-muted">Convertible</dt>
                <dd><Money amountMinor={quote.convertibleMinor} currency={quote.fromCurrency} /></dd>
              </div>
            </dl>

            <Field label="Authorization PIN" htmlFor="fx-pin" hint="Demo PIN: 246810">
              <Input
                id="fx-pin"
                type="password"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={pin}
                onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))}
              />
            </Field>
            <Button type="button" onClick={convert} disabled={pending || pin.length !== 6} className={cn("w-full")}>
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Convert {quote.fromCurrency} → {quote.toCurrency}
            </Button>
            <p className="text-[10px] leading-relaxed text-subtle">
              Quote {quote.id} expires {new Date(quote.expiresAt).toLocaleTimeString("en-GB")}. Rates are synthetic.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
