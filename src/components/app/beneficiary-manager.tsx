"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Building2, Globe2, Loader2, Plus, Search, UserRound, Wallet } from "lucide-react";
import { toast } from "sonner";
import { createBeneficiaryAction } from "@/app/actions/transfers";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import { CURRENCY_CODES } from "@/domain/money";
import { cn } from "@/lib/utils";

type Beneficiary = {
  id: string;
  name: string;
  type: string;
  email: string | null;
  bankName: string | null;
  masked: string | null;
  ibanMasked: string | null;
  currency: string;
  country: string;
  linkedAccountId: string | null;
};

const TYPE_META: Record<string, { label: string; icon: typeof Building2; tone: string }> = {
  bank: { label: "Bank account", icon: Building2, tone: "bg-info-soft text-info" },
  wallet: { label: "External wallet", icon: Wallet, tone: "bg-violet-soft text-violet" },
  internal: { label: "Atlas peer", icon: UserRound, tone: "bg-success-soft text-success" },
};

export function BeneficiaryManager({ beneficiaries }: { beneficiaries: Beneficiary[] }) {
  const [open, setOpen] = useState(beneficiaries.length === 0);
  const [search, setSearch] = useState("");
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    name: "",
    type: "bank" as "bank" | "wallet",
    email: "",
    bankName: "",
    accountMasked: "",
    ibanMasked: "",
    currency: "USD",
    country: "US",
  });

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return beneficiaries;
    return beneficiaries.filter((item) =>
      [item.name, item.bankName, item.email, item.currency, item.country]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [beneficiaries, search]);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function submit() {
    if (!form.name.trim() || !form.accountMasked.trim()) {
      toast.error("Add a name and an account identifier.");
      return;
    }
    startTransition(async () => {
      const result = await createBeneficiaryAction({
        name: form.name.trim(),
        type: form.type,
        email: form.email.trim() || undefined,
        bankName: form.bankName.trim() || undefined,
        accountMasked: form.accountMasked.trim(),
        ibanMasked: form.ibanMasked.trim() || undefined,
        currency: form.currency,
        country: form.country.trim().toUpperCase().slice(0, 2) || "US",
      });
      if (!result.ok) {
        toast.error(result.error ?? "Could not save beneficiary.");
        return;
      }
      toast.success("Beneficiary saved.");
      setForm((current) => ({ ...current, name: "", email: "", bankName: "", accountMasked: "", ibanMasked: "" }));
      setOpen(false);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-subtle" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search beneficiaries"
            className="pl-9"
            aria-label="Search beneficiaries"
          />
        </div>
        <Button type="button" variant={open ? "secondary" : "primary"} size="sm" onClick={() => setOpen((value) => !value)}>
          <Plus className="h-3.5 w-3.5" /> {open ? "Close form" : "Add beneficiary"}
        </Button>
      </div>

      {open ? (
        <section className="surface-card p-5">
          <h2 className="text-[14px] font-semibold tracking-tight">New beneficiary</h2>
          <p className="mt-0.5 text-[12px] text-muted">
            Only masked identifiers are stored. Full account numbers are never persisted in this sandbox.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Display name" htmlFor="ben-name">
              <Input id="ben-name" value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="Acme Supplies Ltd" />
            </Field>
            <Field label="Type" htmlFor="ben-type">
              <Select id="ben-type" value={form.type} onChange={(event) => update("type", event.target.value as "bank" | "wallet")}>
                <option value="bank">Bank account</option>
                <option value="wallet">External wallet</option>
              </Select>
            </Field>
            <Field label="Email (optional)" htmlFor="ben-email">
              <Input id="ben-email" type="email" value={form.email} onChange={(event) => update("email", event.target.value)} placeholder="payments@example.com" />
            </Field>
            <Field label="Bank or provider (optional)" htmlFor="ben-bank">
              <Input id="ben-bank" value={form.bankName} onChange={(event) => update("bankName", event.target.value)} placeholder="Example Bank" />
            </Field>
            <Field label="Account identifier" htmlFor="ben-account" hint="Masked form, e.g. •••• 4821">
              <Input id="ben-account" value={form.accountMasked} onChange={(event) => update("accountMasked", event.target.value)} placeholder="•••• 4821" />
            </Field>
            <Field label="IBAN (optional, masked)" htmlFor="ben-iban">
              <Input id="ben-iban" value={form.ibanMasked} onChange={(event) => update("ibanMasked", event.target.value)} placeholder="GB•• •••• •••• 4821" />
            </Field>
            <Field label="Currency" htmlFor="ben-currency">
              <Select id="ben-currency" value={form.currency} onChange={(event) => update("currency", event.target.value)}>
                {CURRENCY_CODES.map((code) => (
                  <option key={code} value={code}>{code}</option>
                ))}
              </Select>
            </Field>
            <Field label="Country (ISO-2)" htmlFor="ben-country">
              <Input id="ben-country" value={form.country} maxLength={2} onChange={(event) => update("country", event.target.value.toUpperCase())} placeholder="US" />
            </Field>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <Button type="button" onClick={submit} disabled={pending}>
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Save beneficiary
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </section>
      ) : null}

      {filtered.length === 0 ? (
        <EmptyState
          title={beneficiaries.length === 0 ? "No beneficiaries yet" : "No matching beneficiaries"}
          description={beneficiaries.length === 0 ? "Add a bank or wallet to send external transfers." : "Try a different search term."}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((beneficiary) => {
            const meta = TYPE_META[beneficiary.type] ?? TYPE_META.bank!;
            const Icon = meta.icon;
            return (
              <article key={beneficiary.id} className="surface-card flex flex-col p-4">
                <div className="flex items-start gap-3">
                  <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]", meta.tone)}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold">{beneficiary.name}</p>
                    <p className="mt-0.5 text-[10.5px] text-muted">{beneficiary.bankName ?? meta.label}</p>
                  </div>
                  <Badge variant="outline">{beneficiary.currency}</Badge>
                </div>
                <dl className="mt-3 space-y-1 text-[10.5px]">
                  <div className="flex justify-between gap-2">
                    <dt className="text-subtle">Identifier</dt>
                    <dd className="mono text-muted">{beneficiary.masked ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-subtle">Country</dt>
                    <dd className="text-muted">{beneficiary.country}</dd>
                  </div>
                  {beneficiary.email ? (
                    <div className="flex justify-between gap-2">
                      <dt className="text-subtle">Email</dt>
                      <dd className="truncate text-muted">{beneficiary.email}</dd>
                    </div>
                  ) : null}
                </dl>
                <div className="mt-3 flex items-center gap-2 border-t border-border/70 pt-3">
                  <Button asChild size="sm" variant="secondary" className="flex-1">
                    <Link href={`/app/transfers/new?mode=external&beneficiary=${beneficiary.id}`}>
                      <Globe2 className="h-3.5 w-3.5" /> Send
                    </Link>
                  </Button>
                  <span className="text-[9px] text-subtle">{beneficiary.linkedAccountId ? "Atlas peer" : "External"}</span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
