import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpenCheck,
  Boxes,
  Check,
  CheckCircle2,
  ChevronRight,
  Fingerprint,
  GitCompareArrows,
  Globe2,
  Landmark,
  LockKeyhole,
  ReceiptText,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Wallet,
  Workflow,
} from "lucide-react";
import { AtlasMark } from "@/components/brand/logo";
import { MarketingFooter, MarketingNav } from "@/components/marketing/chrome";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DEMO_PERSONAS } from "@/lib/demo";
import { formatMoney } from "@/domain/money";

const FX_ROWS = [
  ["USD → EUR", "0.9214", "−35 bps", "90 sec"],
  ["USD → GBP", "0.7892", "−35 bps", "90 sec"],
  ["USD → JPY", "151.4200", "−35 bps", "90 sec"],
  ["GBP → EUR", "1.1675", "−35 bps", "90 sec"],
];

const FAQS = [
  {
    q: "Is this a real bank?",
    a: "No. ATLAS is a sandbox and portfolio project. Every account, card, identity, invoice and exchange rate is synthetic. No deposits are accepted and no live payment rails are connected.",
  },
  {
    q: "What makes the ledger different?",
    a: "Balances are never stored as a mutable number. They are derived from signed postings. Every journal must sum to zero per currency, and database triggers reject unbalanced or mutated postings.",
  },
  {
    q: "Can platform staff move customer money?",
    a: "No. Operations roles can inspect, reconcile and annotate, but customer fund movement is restricted to the customer or authorized organization member. Every privileged action is audited.",
  },
  {
    q: "How are approvals enforced?",
    a: "Maker-checker is enforced server-side. A request moves through an approver step and a finance-manager step. Self-approval is blocked and a step-up PIN is required at the decision point.",
  },
  {
    q: "Can I run it locally?",
    a: "Yes. The app uses SQLite for zero-setup local persistence, with a documented path to Postgres. Run npm install, then npm run dev. The database migrates and seeds automatically.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-dvh bg-background">
      <MarketingNav />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 atlas-grid opacity-70" />
        <div className="absolute left-1/2 top-[-20%] h-[520px] w-[720px] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]" />
        <div className="relative mx-auto grid max-w-[1240px] gap-14 px-5 pb-20 pt-16 sm:px-8 sm:pt-24 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:pb-28">
          <div className="animate-rise">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/80 px-3 py-1.5 text-[10.5px] font-semibold text-muted shadow-soft backdrop-blur">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-teal" />
              </span>
              Sandbox fintech OS · v0.1
              <span className="mono ml-1 rounded bg-surface-2 px-1.5 py-0.5 text-[9px] text-subtle">SYNTHETIC</span>
            </div>

            <h1 className="mt-6 max-w-2xl text-[42px] font-semibold leading-[1.02] tracking-[-0.045em] sm:text-[58px] lg:text-[64px]">
              The operating system for money that has to{" "}
              <span className="relative whitespace-nowrap">
                <span className="relative z-10 bg-gradient-to-r from-primary via-teal to-violet bg-clip-text text-transparent">
                  make sense
                </span>
                <svg className="absolute -bottom-1 left-0 h-3 w-full text-primary/25" viewBox="0 0 200 12" preserveAspectRatio="none" aria-hidden="true">
                  <path d="M2 9c40-6 92-8 196-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
              </span>
              .
            </h1>

            <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-muted">
              Customer banking, business finance, approvals, reconciliation and a double-entry
              ledger — designed as one coherent product. Every balance is derived, every movement
              is provable, every privileged action is audited.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link href="/login">
                  Enter the sandbox <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/#ledger">
                  See the ledger <BookOpenCheck className="h-4 w-4" />
                </Link>
              </Button>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-muted">
              {["No real money", "Server-enforced RBAC", "Step-up authorization", "Audited by design"].map((item) => (
                <span key={item} className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-teal" /> {item}
                </span>
              ))}
            </div>
          </div>

          <div className="relative animate-rise [animation-delay:120ms]">
            <div className="absolute -right-6 -top-6 hidden h-24 w-24 rounded-full bg-teal/15 blur-2xl sm:block" />
            <div className="relative rounded-[24px] border border-border bg-surface/90 p-3 shadow-float backdrop-blur">
              <div className="rounded-[18px] border border-border/80 bg-background/60 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AtlasMark className="h-6 w-6" />
                    <div>
                      <p className="text-[11px] font-semibold">Maya Chen</p>
                      <p className="mono text-[8.5px] uppercase tracking-[0.14em] text-subtle">Personal · sandbox</p>
                    </div>
                  </div>
                  <Badge variant="teal" className="text-[9px]">
                    <span className="h-1 w-1 rounded-full bg-teal" /> Live ledger
                  </Badge>
                </div>

                <div className="mt-5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-subtle">Total balance · indicative USD</p>
                  <p className="amount mt-1 text-[34px] font-semibold tracking-[-0.04em]">
                    {formatMoney(2_016_108, "USD")}
                    <span className="ml-2 align-middle text-[11px] font-semibold text-success">+2.4%</span>
                  </p>
                  <div className="mt-3 h-16 w-full">
                    <svg viewBox="0 0 320 64" className="h-full w-full" preserveAspectRatio="none" aria-hidden="true">
                      <defs>
                        <linearGradient id="hero-spark" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--teal)" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="var(--teal)" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path d="M0 52 C30 50 42 38 62 40 S96 48 118 32 S150 14 176 22 S208 36 232 26 S270 8 296 12 L320 8 L320 64 L0 64 Z" fill="url(#hero-spark)" />
                      <path d="M0 52 C30 50 42 38 62 40 S96 48 118 32 S150 14 176 22 S208 36 232 26 S270 8 296 12 L320 8" fill="none" stroke="var(--teal)" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  {[
                    ["USD", 2_016_108, "checking"],
                    ["EUR", 343_128, "wallet"],
                    ["GBP", 125_350, "wallet"],
                  ].map(([code, amount, kind]) => (
                    <div key={code as string} className="rounded-[10px] border border-border bg-surface p-2.5">
                      <div className="flex items-center justify-between">
                        <span className="mono text-[9px] font-semibold text-muted">{code}</span>
                        <span className="text-[8px] uppercase tracking-[0.1em] text-subtle">{kind}</span>
                      </div>
                      <p className="amount mt-1.5 text-[12.5px] font-semibold">{formatMoney(amount as number, code as string)}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-3 space-y-1.5">
                  {[
                    ["Whole Foods", "Groceries", "−$84.20"],
                    ["Salary — Northstar", "Income", "+$6,400.00"],
                    ["Kyoto 2027", "Goal transfer", "−$150.00"],
                  ].map(([name, category, amount]) => (
                    <div key={name} className="flex items-center gap-2.5 rounded-[9px] px-1 py-1.5">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-2">
                        <ReceiptText className="h-3 w-3 text-muted" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[10.5px] font-semibold">{name}</p>
                        <p className="text-[8.5px] text-subtle">{category}</p>
                      </div>
                      <span className={`mono text-[10px] font-medium ${amount.startsWith("+") ? "text-success" : "text-foreground"}`}>{amount}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="absolute -bottom-6 -left-5 hidden w-[210px] rounded-[14px] border border-border bg-elevated p-3 shadow-float sm:block animate-float">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-soft">
                  <Check className="h-3 w-3 text-teal" />
                </span>
                <p className="text-[10px] font-semibold">Journal balanced</p>
              </div>
              <div className="mono mt-2 flex items-center justify-between text-[8.5px] text-subtle">
                <span>JRN-8F2A · 2 postings</span>
                <span className="text-teal">0.00 USD</span>
              </div>
            </div>

            <div className="absolute -right-3 top-24 hidden rounded-[12px] border border-border bg-elevated px-3 py-2 shadow-float md:block">
              <p className="mono text-[8px] uppercase tracking-[0.12em] text-subtle">FX quote</p>
              <p className="amount mt-0.5 text-[11px] font-semibold">1 USD = 0.9214 EUR</p>
              <p className="mt-0.5 text-[8px] text-warning">expires in 90s</p>
            </div>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-y border-border bg-surface/50">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <p className="mono text-[9.5px] uppercase tracking-[0.16em] text-subtle">Designed as a system, not a screen</p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] font-medium text-muted">
            <span className="inline-flex items-center gap-1.5"><BookOpenCheck className="h-3.5 w-3.5" /> Double-entry core</span>
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Maker-checker</span>
            <span className="inline-flex items-center gap-1.5"><ScanSearch className="h-3.5 w-3.5" /> Reconciliation</span>
            <span className="inline-flex items-center gap-1.5"><LockKeyhole className="h-3.5 w-3.5" /> Step-up PIN</span>
            <span className="inline-flex items-center gap-1.5"><Fingerprint className="h-3.5 w-3.5" /> Audit trail</span>
          </div>
        </div>
      </section>

      {/* Product surfaces */}
      <section id="product" className="mx-auto max-w-[1240px] px-5 py-20 sm:px-8 sm:py-24">
        <SectionIntro
          eyebrow="Three surfaces · one source of truth"
          title="Built for the whole money journey."
          description="Personal banking, company finance and platform operations share the same ledger, permission model and audit trail. Nothing is a disconnected mock-up."
        />
        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {[
            {
              icon: Wallet,
              tone: "primary",
              label: "Personal",
              title: "Banking that explains itself",
              body: "Multi-currency wallets, FX quotes, virtual cards, budgets, goals and an intelligence canvas that connects every transaction to a decision.",
              points: ["Money Flow Explorer", "Virtual Card Studio", "Budget & goal controls"],
              href: "/login",
              cta: "Explore personal demo",
            },
            {
              icon: Landmark,
              tone: "teal",
              label: "Business",
              title: "Finance operations, with guardrails",
              body: "Invoices, bills, vendors, expenses and approvals with maker-checker enforcement, policy flags and an approval cockpit that shows who decided what.",
              points: ["Two-step approvals", "Policy-aware expenses", "Treasury reporting"],
              href: "/login",
              cta: "Explore business demo",
            },
            {
              icon: ScanSearch,
              tone: "violet",
              label: "Operations",
              title: "Risk, reconciliation, proof",
              body: "A 360° customer view, risk and compliance casework, provider reconciliation and a Transparency Lab for inspecting every journal and posting.",
              points: ["Reconciliation exceptions", "Risk casework", "Ledger inspection"],
              href: "/login",
              cta: "Explore operations demo",
            },
          ].map((surface) => (
            <article key={surface.label} className="group relative flex flex-col overflow-hidden rounded-[18px] border border-border bg-surface p-6 shadow-soft transition-all hover:-translate-y-1 hover:shadow-float">
              <div className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${
                surface.tone === "primary" ? "from-primary to-violet" : surface.tone === "teal" ? "from-teal to-primary" : "from-violet to-teal"
              }`} />
              <div className="flex items-center justify-between">
                <span className={`flex h-10 w-10 items-center justify-center rounded-[11px] ${
                  surface.tone === "primary" ? "bg-primary-soft text-primary" : surface.tone === "teal" ? "bg-teal-soft text-teal" : "bg-violet-soft text-violet"
                }`}>
                  <surface.icon className="h-5 w-5" />
                </span>
                <span className="mono text-[9px] uppercase tracking-[0.14em] text-subtle">{surface.label}</span>
              </div>
              <h3 className="mt-5 text-[18px] font-semibold tracking-[-0.025em]">{surface.title}</h3>
              <p className="mt-2 text-[12.5px] leading-relaxed text-muted">{surface.body}</p>
              <ul className="mt-4 space-y-1.5">
                {surface.points.map((point) => (
                  <li key={point} className="flex items-center gap-2 text-[11.5px] text-muted">
                    <Check className="h-3 w-3 text-teal" /> {point}
                  </li>
                ))}
              </ul>
              <Link href={surface.href} className="mt-5 inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-primary">
                {surface.cta} <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            </article>
          ))}
        </div>
      </section>

      {/* Ledger */}
      <section id="ledger" className="border-y border-border bg-[#08111f] text-white">
        <div className="relative mx-auto max-w-[1240px] overflow-hidden px-5 py-20 sm:px-8 sm:py-24">
          <div className="absolute right-0 top-0 h-[420px] w-[420px] rounded-full bg-[#2246a8]/25 blur-[110px]" />
          <div className="relative grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <p className="eyebrow !text-[#5fdccb]">Ledger-first architecture</p>
              <h2 className="mt-4 text-[34px] font-semibold leading-[1.08] tracking-[-0.04em] sm:text-[44px]">
                Balances are opinions.
                <span className="block text-white/40">Postings are facts.</span>
              </h2>
              <p className="mt-5 max-w-md text-[13.5px] leading-relaxed text-white/55">
                ATLAS never mutates a balance. Every movement creates a journal with signed
                postings. Each currency must sum to zero before the database will accept it.
              </p>
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                {[
                  ["Immutable", "Posted entries reject UPDATE and DELETE at the database layer."],
                  ["Balanced", "Triggers reject journals whose postings do not net to zero."],
                  ["Minor units", "Integer money only. No floating-point balances."],
                  ["Reversible", "Corrections are compensating journals, never edits."],
                ].map(([title, body]) => (
                  <div key={title} className="rounded-[11px] border border-white/10 bg-white/[0.03] p-3.5">
                    <p className="text-[11.5px] font-semibold text-white/85">{title}</p>
                    <p className="mt-1 text-[10.5px] leading-relaxed text-white/40">{body}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-3 shadow-float backdrop-blur-sm">
              <div className="flex items-center justify-between px-2 py-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#5fdccb]/10">
                    <BookOpenCheck className="h-3.5 w-3.5 text-[#5fdccb]" />
                  </span>
                  <div>
                    <p className="text-[11px] font-semibold">Journal JRN-8F2A</p>
                    <p className="mono text-[8px] uppercase tracking-[0.14em] text-white/30">Transfer · posted</p>
                  </div>
                </div>
                <span className="rounded-full border border-[#5fdccb]/25 bg-[#5fdccb]/10 px-2 py-0.5 text-[8.5px] font-semibold text-[#5fdccb]">
                  Balanced
                </span>
              </div>
              <div className="mt-1 overflow-hidden rounded-[12px] border border-white/10">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/[0.03] text-[8px] uppercase tracking-[0.12em] text-white/30">
                      <th className="px-3 py-2 font-medium">Ledger account</th>
                      <th className="px-3 py-2 font-medium">Side</th>
                      <th className="px-3 py-2 text-right font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="mono text-[10px]">
                    {[
                      ["CUST-ACC_MAYA_USD", "Debit", "1,000.00 USD", "text-white/75"],
                      ["SYS-SETTLEMENT-USD", "Credit", "1,000.00 USD", "text-[#5fdccb]"],
                    ].map(([account, side, amount, tone]) => (
                      <tr key={account} className="border-b border-white/[0.06] last:border-0">
                        <td className="px-3 py-2.5 text-white/55">{account}</td>
                        <td className="px-3 py-2.5 text-white/35">{side}</td>
                        <td className={`px-3 py-2.5 text-right ${tone}`}>{amount}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-white/10 bg-white/[0.02]">
                      <td className="px-3 py-2 text-[8.5px] uppercase tracking-[0.12em] text-white/30" colSpan={2}>Sum by currency</td>
                      <td className="mono px-3 py-2 text-right text-[9.5px] text-[#5fdccb]">0.00 USD</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div className="mono mt-2 flex items-center justify-between px-2 py-1 text-[8px] text-white/25">
                <span>actor usr_maya · transfer trf_8f2a</span>
                <span>2026-10-31T09:14:22Z</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Business + ops */}
      <section id="business" className="mx-auto max-w-[1240px] px-5 py-20 sm:px-8 sm:py-24">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="surface-card relative overflow-hidden p-6 sm:p-8">
            <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-teal/10 blur-2xl" />
            <Badge variant="teal"><Workflow className="h-3 w-3" /> Approval cockpit</Badge>
            <h3 className="mt-4 text-[24px] font-semibold tracking-[-0.03em]">Two people. One decision.</h3>
            <p className="mt-2 max-w-md text-[12.5px] leading-relaxed text-muted">
              Requests move through a first-line approver and a finance manager. Self-approval is
              rejected by the service layer, not hidden by the interface.
            </p>
            <div className="mt-6 space-y-2.5">
              {[
                ["Figma annual seats", "$1,440.00", "Approver step", "warning"],
                ["Apple Store — Sam", "$1,299.00", "Finance step", "info"],
                ["Studio lighting kit", "$3,400.00", "Approver step", "warning"],
              ].map(([title, amount, step, tone]) => (
                <div key={title} className="flex items-center gap-3 rounded-[11px] border border-border bg-surface px-3.5 py-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-2">
                    <ReceiptText className="h-3.5 w-3.5 text-muted" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11.5px] font-semibold">{title}</p>
                    <p className="text-[9.5px] text-subtle">{step}</p>
                  </div>
                  <span className="mono text-[11px] font-medium">{amount}</span>
                  <span className={`h-1.5 w-1.5 rounded-full ${tone === "warning" ? "bg-warning" : "bg-info"}`} />
                </div>
              ))}
            </div>
            <div className="mt-5 flex items-center gap-2 rounded-[9px] bg-surface-2 px-3 py-2 text-[10px] text-muted">
              <Fingerprint className="h-3.5 w-3.5" /> Decision requires PIN 246810 and a written rationale.
            </div>
          </div>

          <div id="operations" className="surface-card relative overflow-hidden p-6 sm:p-8">
            <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-violet/10 blur-2xl" />
            <Badge variant="violet"><GitCompareArrows className="h-3 w-3" /> Reconciliation</Badge>
            <h3 className="mt-4 text-[24px] font-semibold tracking-[-0.03em]">Trust, but verify the difference.</h3>
            <p className="mt-2 max-w-md text-[12.5px] leading-relaxed text-muted">
              Provider events are compared with ledger movements by currency. Differences become
              explicit exceptions, never silent adjustments.
            </p>
            <div className="mt-6 rounded-[12px] border border-border">
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 border-b border-border bg-surface-2/60 px-3.5 py-2 text-[8.5px] uppercase tracking-[0.12em] text-subtle">
                <span>Batch</span><span>Ledger</span><span>Provider</span><span>Δ</span>
              </div>
              {[
                ["USD card batch", "$12,480.00", "$12,480.00", "0", "success"],
                ["USD vendor payout", "$8,200.00", "$8,187.50", "$12.50", "danger"],
                ["EUR SEPA batch", "€450.00", "€450.00", "0", "success"],
                ["GBP Faster Payments", "£220.00", "£220.00", "0", "success"],
              ].map(([label, ledger, provider, diff, tone]) => (
                <div key={label} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 border-b border-border/60 px-3.5 py-2.5 text-[10px] last:border-0">
                  <span className="truncate text-muted">{label}</span>
                  <span className="mono text-foreground">{ledger}</span>
                  <span className="mono text-muted">{provider}</span>
                  <span className={`mono font-semibold ${tone === "danger" ? "text-danger" : "text-success"}`}>{diff}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between rounded-[9px] border border-warning/20 bg-warning-soft px-3 py-2">
              <span className="text-[10.5px] font-medium text-warning">1 exception requires review</span>
              <ChevronRight className="h-3.5 w-3.5 text-warning" />
            </div>
          </div>
        </div>
      </section>

      {/* FX */}
      <section className="border-y border-border bg-surface/40">
        <div className="mx-auto grid max-w-[1240px] gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[1fr_1.2fr] lg:items-center">
          <div>
            <p className="eyebrow">Sandbox FX</p>
            <h2 className="mt-3 text-[28px] font-semibold tracking-[-0.035em] sm:text-[34px]">
              Rates with receipts, not mystery.
            </h2>
            <p className="mt-3 max-w-md text-[12.5px] leading-relaxed text-muted">
              Quotes expire in 90 seconds and persist the rate, fee and rounding policy. The source
              is labelled synthetic — this is a simulation adapter, not market data.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Badge variant="warning">Synthetic rates</Badge>
              <Badge variant="neutral">90s TTL</Badge>
              <Badge variant="neutral">35 bps markup</Badge>
              <Badge variant="neutral">Half-up rounding</Badge>
            </div>
          </div>
          <div className="overflow-hidden rounded-[14px] border border-border bg-surface">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <Globe2 className="h-4 w-4 text-teal" />
                <span className="text-[11.5px] font-semibold">Reference rates</span>
              </div>
              <span className="mono text-[8.5px] uppercase tracking-[0.12em] text-subtle">as of 09:00 UTC</span>
            </div>
            <div className="grid grid-cols-[1.2fr_1fr_0.8fr_0.7fr] gap-2 border-b border-border bg-surface-2/50 px-4 py-2 text-[8.5px] uppercase tracking-[0.12em] text-subtle">
              <span>Pair</span><span>Rate</span><span>Markup</span><span>TTL</span>
            </div>
            {FX_ROWS.map(([pair, rate, markup, ttl]) => (
              <div key={pair} className="grid grid-cols-[1.2fr_1fr_0.8fr_0.7fr] items-center gap-2 border-b border-border/60 px-4 py-3 text-[11px] last:border-0">
                <span className="font-medium">{pair}</span>
                <span className="mono text-muted">{rate}</span>
                <span className="mono text-[10px] text-warning">{markup}</span>
                <span className="mono text-[10px] text-subtle">{ttl}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security */}
      <section id="security" className="mx-auto max-w-[1240px] px-5 py-20 sm:px-8 sm:py-24">
        <SectionIntro
          eyebrow="Security by design"
          title="The interface is not the security boundary."
          description="Permissions, ownership and state transitions are enforced in the service layer and backed by database constraints. The UI only reflects what the server already allows."
        />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: ShieldCheck, title: "Server-enforced RBAC", body: "Platform and organization roles resolve to explicit permissions on every service call." },
            { icon: LockKeyhole, title: "Step-up authorization", body: "Transfers and approval decisions require a PIN, rate-limited per user." },
            { icon: Fingerprint, title: "Immutable audit", body: "Logins, transfers, decisions, role changes and corrections write append-only audit events." },
            { icon: Boxes, title: "Defense in depth", body: "Ownership checks, idempotency keys, holds and database triggers prevent double-spend." },
          ].map((item) => (
            <div key={item.title} className="rounded-[15px] border border-border bg-surface p-5">
              <item.icon className="h-5 w-5 text-primary" />
              <p className="mt-4 text-[13px] font-semibold">{item.title}</p>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Personas */}
      <section className="border-y border-border bg-surface/40">
        <div className="mx-auto max-w-[1240px] px-5 py-16 sm:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="eyebrow">Nine perspectives</p>
              <h2 className="mt-2 text-[26px] font-semibold tracking-[-0.035em]">One system, different authority.</h2>
            </div>
            <Link href="/login" className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-primary">
              Choose a persona <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="mt-7 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {DEMO_PERSONAS.map((persona) => (
              <Link
                key={persona.email}
                href="/login"
                className="group flex items-center gap-3 rounded-[11px] border border-border bg-surface px-3.5 py-3 transition-all hover:-translate-y-0.5 hover:border-border-strong hover:shadow-soft"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-2 text-[10px] font-bold text-muted">
                  {persona.initials}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11.5px] font-semibold">{persona.name}</p>
                  <p className="truncate text-[10px] text-muted">{persona.role}</p>
                </div>
                <span className="mono text-[8px] uppercase tracking-[0.1em] text-subtle">{persona.area}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-[880px] px-5 py-20 sm:px-8 sm:py-24">
        <SectionIntro eyebrow="Questions" title="What this is — and what it is not." />
        <div className="mt-8 divide-y divide-border rounded-[16px] border border-border bg-surface">
          {FAQS.map((faq) => (
            <details key={faq.q} className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer items-center justify-between gap-4 text-[13px] font-semibold">
                {faq.q}
                <ChevronRight className="h-4 w-4 shrink-0 text-subtle transition-transform group-open:rotate-90" />
              </summary>
              <p className="mt-3 max-w-2xl text-[12px] leading-relaxed text-muted">{faq.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-[1240px] px-5 pb-20 sm:px-8">
        <div className="relative overflow-hidden rounded-[24px] border border-primary/20 bg-gradient-to-br from-primary via-[#1c3d95] to-[#0b6a66] px-6 py-14 text-center text-white shadow-float sm:px-12">
          <div className="absolute inset-0 atlas-dots opacity-20" />
          <div className="relative">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]">
              <Sparkles className="h-3 w-3" /> Fully seeded sandbox
            </span>
            <h2 className="mx-auto mt-5 max-w-2xl text-[32px] font-semibold leading-[1.08] tracking-[-0.04em] sm:text-[42px]">
              Open the ledger. Follow the money.
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-[13px] leading-relaxed text-white/65">
              Nine personas, real state transitions, and a complete audit trail — ready in one click.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg" className="bg-white text-[#0f1e35] hover:bg-white/90">
                <Link href="/login">Enter the sandbox <ArrowRight className="h-4 w-4" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white/25 bg-white/5 text-white hover:bg-white/10">
                <Link href="/developers">Read the API docs</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}

function SectionIntro({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="max-w-2xl">
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="mt-3 text-[30px] font-semibold leading-[1.1] tracking-[-0.04em] sm:text-[38px]">{title}</h2>
      {description ? <p className="mt-3 text-[13px] leading-relaxed text-muted">{description}</p> : null}
    </div>
  );
}
