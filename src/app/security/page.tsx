import Link from "next/link";
import {
  ArrowRight,
  Database,
  Fingerprint,
  KeyRound,
  LockKeyhole,
  ScrollText,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { MarketingFooter, MarketingNav } from "@/components/marketing/chrome";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/misc";

export const metadata = {
  title: "Security",
  description: "ATLAS security model: server-enforced RBAC, step-up authorization, immutable ledger and audit.",
};

const CONTROLS = [
  {
    icon: UserCheck,
    title: "Authorization at the service layer",
    body: "Every read and write resolves an actor, a resource owner and a permission. Route guards are convenience; the service layer is the boundary.",
    detail: ["Business roles: owner, finance manager, approver, employee", "Platform roles: support, risk, compliance, admin, super admin", "Platform staff never inherit customer fund-movement authority"],
  },
  {
    icon: LockKeyhole,
    title: "Step-up authorization",
    body: "Sensitive actions require a six-digit PIN that is verified server-side and rate-limited. A stolen session alone cannot move money or approve spend.",
    detail: ["Scrypt PIN hashing with per-secret salt", "Five attempts per five-minute window", "Required for transfers and approval decisions"],
  },
  {
    icon: Database,
    title: "Database-enforced integrity",
    body: "The ledger is protected by triggers, not only application code. Posted postings cannot be updated or deleted, and journals must balance per currency.",
    detail: ["Signed integer minor units", "Per-currency zero-sum check", "Immutable posted journals and postings"],
  },
  {
    icon: ScrollText,
    title: "Append-only audit trail",
    body: "Authentication, transfers, approvals, role changes, risk decisions, reconciliation and ledger corrections write audit events with actor and request context.",
    detail: ["Actor and role captured", "Resource and organization scoped", "IP and request identifiers retained"],
  },
  {
    icon: KeyRound,
    title: "Session and secret hygiene",
    body: "Session tokens are random, stored only as hashes and delivered in HttpOnly, SameSite cookies. API keys are shown once and persisted as hashes.",
    detail: ["Eight-hour sessions with server-side revocation", "Hashed session and API-key material", "Origin checks on state-changing requests"],
  },
  {
    icon: Fingerprint,
    title: "Financial state machines",
    body: "Transfers, holds and approvals move through explicit states. Idempotency keys prevent duplicate postings; holds reserve available balance before settlement.",
    detail: ["Idempotent transfer submission", "Holds for processing payouts", "Compensating journals for corrections"],
  },
];

export default function SecurityPage() {
  return (
    <div className="min-h-dvh bg-background">
      <MarketingNav />
      <main className="mx-auto max-w-[1100px] px-5 py-16 sm:px-8 sm:py-24">
        <div className="max-w-3xl">
          <Badge variant="teal"><ShieldCheck className="h-3 w-3" /> Security model</Badge>
          <h1 className="mt-5 text-[40px] font-semibold leading-[1.05] tracking-[-0.045em] sm:text-[54px]">
            Trust is a property of the system, not a promise on a page.
          </h1>
          <p className="mt-5 text-[14px] leading-relaxed text-muted">
            ATLAS is a sandbox, but its security model is built the way a financial product should
            be: explicit permissions, server-side checks, immutable records and a clear boundary
            between customer authority and platform operations.
          </p>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {CONTROLS.map((control) => (
            <section key={control.title} className="surface-card p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-[11px] bg-primary-soft text-primary">
                <control.icon className="h-5 w-5" />
              </span>
              <h2 className="mt-4 text-[16px] font-semibold tracking-tight">{control.title}</h2>
              <p className="mt-2 text-[12px] leading-relaxed text-muted">{control.body}</p>
              <ul className="mt-4 space-y-1.5">
                {control.detail.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-[11px] text-muted">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-teal" />
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <section className="mt-12 overflow-hidden rounded-[18px] border border-border bg-surface">
          <div className="border-b border-border px-6 py-5">
            <p className="eyebrow">Permission excerpts</p>
            <h2 className="mt-2 text-[20px] font-semibold tracking-tight">Who can do what</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11.5px]">
              <thead>
                <tr className="border-b border-border bg-surface-2/60 text-[9px] uppercase tracking-[0.12em] text-subtle">
                  <th className="px-6 py-2.5 font-semibold">Capability</th>
                  <th className="px-4 py-2.5 font-semibold">Employee</th>
                  <th className="px-4 py-2.5 font-semibold">Approver</th>
                  <th className="px-4 py-2.5 font-semibold">Finance</th>
                  <th className="px-4 py-2.5 font-semibold">Owner</th>
                  <th className="px-4 py-2.5 font-semibold">Ops</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Submit expense", "✓", "✓", "✓", "✓", "—"],
                  ["Approve spend", "—", "✓", "✓", "✓", "—"],
                  ["Pay a bill", "—", "—", "✓", "✓", "—"],
                  ["Move customer funds", "—", "—", "—", "—", "—"],
                  ["Reconcile providers", "—", "—", "—", "—", "admin"],
                  ["Inspect ledger", "—", "—", "—", "—", "admin"],
                  ["Manage API keys", "—", "—", "—", "✓", "admin"],
                ].map((row) => (
                  <tr key={row[0]} className="border-b border-border/60 last:border-0">
                    <td className="px-6 py-2.5 font-medium">{row[0]}</td>
                    {row.slice(1).map((cell, index) => (
                      <td key={index} className={`mono px-4 py-2.5 ${cell === "—" ? "text-subtle" : cell === "admin" ? "text-warning" : "text-teal"}`}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-12 rounded-[18px] border border-warning/20 bg-warning-soft p-6">
          <h2 className="text-[15px] font-semibold text-warning">Sandbox disclosure</h2>
          <p className="mt-2 max-w-3xl text-[12px] leading-relaxed text-warning/90">
            ATLAS is not a bank, payment institution or regulated financial service. It does not
            accept deposits, hold customer funds, or connect to live payment rails. All identities,
            balances, cards, invoices and exchange rates are synthetic. Security patterns shown here
            are implementation choices for a portfolio project, not a certification or audit opinion.
          </p>
        </section>

        <div className="mt-10 flex flex-wrap gap-3">
          <Button asChild><Link href="/login">Enter the sandbox <ArrowRight className="h-4 w-4" /></Link></Button>
          <Button asChild variant="outline"><Link href="/docs/rbac">Read the full RBAC matrix</Link></Button>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
