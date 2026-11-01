import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowUpRight, CheckCircle2, Fingerprint, ShieldCheck } from "lucide-react";
import { demoSignInAction } from "@/app/actions/auth";
import { AtlasMark, AtlasWordmark } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import { DEMO_PERSONAS } from "@/lib/demo";
import { getCurrentUser } from "@/lib/auth";
import { homeFor } from "@/lib/home";
import { LoginForm } from "./login-form";

export const metadata = {
  title: "Sign in · ATLAS",
  description: "Sign in to the ATLAS sandbox fintech operating system.",
};

const AREAS = ["Personal", "Business", "Operations"] as const;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user));
  const params = await searchParams;

  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden overflow-hidden bg-[#08111f] text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 atlas-grid opacity-[0.16]" />
        <div className="absolute -left-32 top-20 h-[420px] w-[420px] rounded-full bg-[#2246a8]/30 blur-[100px]" />
        <div className="absolute -right-24 bottom-0 h-[380px] w-[380px] rounded-full bg-[#087e79]/20 blur-[110px]" />

        <div className="relative z-10 flex items-center justify-between p-8 xl:p-12">
          <AtlasWordmark className="[&_span]:text-white [&_span_span:last-child]:text-white/50" subtitle="Sandbox OS" />
          <span className="mono rounded-full border border-white/15 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-white/60">
            v0.1 · synthetic
          </span>
        </div>

        <div className="relative z-10 px-8 pb-10 xl:px-12">
          <p className="eyebrow !text-[#5fdccb]">Financial infrastructure, made legible</p>
          <h1 className="mt-4 max-w-xl text-[42px] font-semibold leading-[1.05] tracking-[-0.04em] xl:text-[54px]">
            Every balance has a story.
            <span className="block text-white/45">Every movement has a proof.</span>
          </h1>
          <p className="mt-5 max-w-md text-[13.5px] leading-relaxed text-white/55">
            A complete fintech operating system — customer banking, business finance, operations and
            a double-entry ledger — running entirely on synthetic money.
          </p>

          <div className="mt-9 max-w-md rounded-[20px] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AtlasMark className="h-6 w-6" />
                <span className="text-[12px] font-semibold text-white/80">Journal · JRN-8F2A</span>
              </div>
              <Badge className="border-[#5fdccb]/30 bg-[#5fdccb]/10 text-[#5fdccb]">
                <CheckCircle2 className="h-3 w-3" /> Balanced
              </Badge>
            </div>
            <div className="mt-4 space-y-2.5">
              {[
                ["Everyday USD · customer liability", "−$1,000.00", "text-white/80"],
                ["Settlement clearing · USD asset", "+$1,000.00", "text-[#5fdccb]"],
              ].map(([label, amount, tone]) => (
                <div key={label} className="flex items-center justify-between gap-4 border-b border-white/[0.06] pb-2.5">
                  <span className="text-[11.5px] text-white/45">{label}</span>
                  <span className={`mono text-[12px] font-medium ${tone}`}>{amount}</span>
                </div>
              ))}
              <div className="flex items-center justify-between gap-4 pt-1">
                <span className="text-[10px] uppercase tracking-[0.14em] text-white/35">Sum by currency</span>
                <span className="mono text-[11px] text-[#5fdccb]">0.00 USD</span>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-6 border-t border-white/[0.08] px-8 py-5 text-[10px] uppercase tracking-[0.14em] text-white/35 xl:px-12">
          <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Server-enforced RBAC</span>
          <span className="flex items-center gap-1.5"><Fingerprint className="h-3.5 w-3.5" /> Step-up PIN</span>
          <span className="ml-auto">No real money</span>
        </div>
      </section>

      <section className="flex min-h-dvh flex-col bg-background">
        <header className="flex items-center justify-between px-5 py-5 sm:px-8">
          <Link href="/" className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-muted hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to atlas.demo
          </Link>
          <span className="mono text-[10px] uppercase tracking-[0.16em] text-subtle">Sandbox access</span>
        </header>

        <div className="mx-auto flex w-full max-w-[480px] flex-1 flex-col justify-center px-5 pb-14 sm:px-8">
          <div className="mb-7">
            <AtlasWordmark className="mb-6 lg:hidden" subtitle="Sandbox OS" />
            <h2 className="text-[28px] font-semibold tracking-[-0.035em]">Welcome back</h2>
            <p className="mt-1.5 text-[13px] text-muted">
              Sign in with a demo persona, or use your credentials.
            </p>
          </div>

          {params.error ? (
            <div role="alert" className="mb-4 rounded-[9px] border border-danger/25 bg-danger-soft px-3 py-2.5 text-[12.5px] font-medium text-danger">
              {params.error}
            </div>
          ) : null}

          <LoginForm next={params.next} />

          <div className="my-8 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-subtle">
              One-click demo personas
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <div className="space-y-5">
            {AREAS.map((area) => (
              <div key={area}>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-subtle">{area}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {DEMO_PERSONAS.filter((persona) => persona.area === area).map((persona) => (
                    <form key={persona.email} action={demoSignInAction}>
                      <input type="hidden" name="email" value={persona.email} />
                      <button
                        type="submit"
                        className="group flex w-full items-start gap-2.5 rounded-[11px] border border-border bg-surface px-3 py-2.5 text-left transition-all hover:-translate-y-0.5 hover:border-border-strong hover:shadow-soft"
                      >
                        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[9.5px] font-bold text-muted">
                          {persona.initials}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5 text-[12px] font-semibold">
                            {persona.name}
                            <ArrowUpRight className="h-3 w-3 text-subtle opacity-0 transition-opacity group-hover:opacity-100" />
                          </span>
                          <span className="mt-0.5 block truncate text-[10.5px] text-muted">{persona.role}</span>
                        </span>
                      </button>
                    </form>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <p className="mt-8 text-center text-[10.5px] leading-relaxed text-subtle">
            This is a portfolio sandbox. Accounts, balances and identities are synthetic.
            <br /> No live financial services are offered.
          </p>
        </div>
      </section>
    </main>
  );
}
