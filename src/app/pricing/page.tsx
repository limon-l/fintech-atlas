import Link from "next/link";
import { ArrowRight, Check, Minus, Sparkles } from "lucide-react";
import { MarketingFooter, MarketingNav } from "@/components/marketing/chrome";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Pricing",
  description: "ATLAS sandbox access tiers. Demonstration only — no real billing.",
};

const PLANS = [
  {
    name: "Personal",
    price: "$0",
    cadence: "sandbox",
    blurb: "Explore customer banking, FX, cards, budgets and goals.",
    features: ["5 synthetic wallets", "Virtual card studio", "Budgets and goals", "Money Flow Explorer", "Full ledger visibility"],
    cta: "Open personal demo",
    href: "/login",
    featured: false,
  },
  {
    name: "Business",
    price: "$0",
    cadence: "sandbox",
    blurb: "Run a simulated company treasury with maker-checker controls.",
    features: ["Everything in Personal", "Invoices, bills and vendors", "Two-step approvals", "Expense policies", "Team roles and reports", "Sandbox API keys"],
    cta: "Open business demo",
    href: "/login",
    featured: true,
  },
  {
    name: "Operations",
    price: "$0",
    cadence: "sandbox",
    blurb: "Inspect risk, compliance, reconciliation and the ledger.",
    features: ["Customer 360", "Risk and compliance queues", "Provider reconciliation", "Ledger Transparency Lab", "Audit and health", "Webhook replay"],
    cta: "Open operations demo",
    href: "/login",
    featured: false,
  },
];

const MATRIX: Array<[string, boolean | string, boolean | string, boolean | string]> = [
  ["Synthetic accounts and balances", true, true, true],
  ["Double-entry ledger inspection", true, true, true],
  ["Business invoicing and bills", false, true, false],
  ["Maker-checker approvals", false, true, false],
  ["Risk and compliance casework", false, false, true],
  ["Reconciliation and exceptions", false, false, true],
  ["API keys and webhook viewer", false, true, "admin"],
  ["Controlled ledger adjustments", false, false, "admin"],
];

export default function PricingPage() {
  return (
    <div className="min-h-dvh bg-background">
      <MarketingNav />
      <main className="mx-auto max-w-[1100px] px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="teal"><Sparkles className="h-3 w-3" /> Demonstration pricing</Badge>
          <h1 className="mt-5 text-[40px] font-semibold leading-[1.05] tracking-[-0.045em] sm:text-[52px]">
            Three surfaces. No invoices.
          </h1>
          <p className="mt-4 text-[13.5px] leading-relaxed text-muted">
            ATLAS is a portfolio sandbox. Nothing on this page is a real offer, and no payment
            method is collected. Every tier unlocks synthetic access only.
          </p>
        </div>

        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          {PLANS.map((plan) => (
            <article
              key={plan.name}
              className={`relative flex flex-col rounded-[18px] border p-6 ${
                plan.featured
                  ? "border-primary/35 bg-surface shadow-float ring-1 ring-primary/15"
                  : "border-border bg-surface shadow-soft"
              }`}
            >
              {plan.featured ? (
                <span className="absolute -top-2.5 left-6 rounded-full bg-primary px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-primary-fg">
                  Most complete
                </span>
              ) : null}
              <div className="flex items-center justify-between">
                <h2 className="text-[16px] font-semibold">{plan.name}</h2>
                <span className="mono text-[9px] uppercase tracking-[0.12em] text-subtle">{plan.cadence}</span>
              </div>
              <p className="mt-1 text-[11.5px] leading-relaxed text-muted">{plan.blurb}</p>
              <div className="mt-5 flex items-baseline gap-1">
                <span className="amount text-[38px] font-semibold tracking-[-0.04em]">{plan.price}</span>
                <span className="text-[11px] text-muted">/ forever</span>
              </div>
              <ul className="mt-5 flex-1 space-y-2">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-[11.5px] text-muted">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal" /> {feature}
                  </li>
                ))}
              </ul>
              <Button asChild className="mt-6 w-full" variant={plan.featured ? "primary" : "secondary"}>
                <Link href={plan.href}>{plan.cta} <ArrowRight className="h-3.5 w-3.5" /></Link>
              </Button>
            </article>
          ))}
        </div>

        <section className="mt-14 overflow-hidden rounded-[18px] border border-border bg-surface">
          <div className="border-b border-border px-6 py-4">
            <h2 className="text-[16px] font-semibold">Capability comparison</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11.5px]">
              <thead>
                <tr className="border-b border-border bg-surface-2/60 text-[9px] uppercase tracking-[0.12em] text-subtle">
                  <th className="px-6 py-2.5 font-semibold">Capability</th>
                  <th className="px-4 py-2.5 font-semibold">Personal</th>
                  <th className="px-4 py-2.5 font-semibold">Business</th>
                  <th className="px-4 py-2.5 font-semibold">Operations</th>
                </tr>
              </thead>
              <tbody>
                {MATRIX.map(([label, personal, business, ops]) => (
                  <tr key={label} className="border-b border-border/60 last:border-0">
                    <td className="px-6 py-2.5 font-medium">{label}</td>
                    {[personal, business, ops].map((cell, index) => (
                      <td key={index} className="px-4 py-2.5">
                        {cell === true ? (
                          <Check className="h-3.5 w-3.5 text-teal" />
                        ) : cell === false ? (
                          <Minus className="h-3.5 w-3.5 text-subtle" />
                        ) : (
                          <span className="mono text-[10px] text-warning">{cell}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <p className="mx-auto mt-8 max-w-2xl text-center text-[10.5px] leading-relaxed text-subtle">
          ATLAS does not provide regulated financial services. Sandbox balances have no monetary
          value and cannot be withdrawn, transferred or redeemed.
        </p>
      </main>
      <MarketingFooter />
    </div>
  );
}
