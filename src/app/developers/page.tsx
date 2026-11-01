import Link from "next/link";
import { ArrowRight, Braces, KeyRound, Radio, Repeat2, ShieldCheck, Terminal } from "lucide-react";
import { MarketingFooter, MarketingNav } from "@/components/marketing/chrome";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Developers",
  description: "ATLAS read-only sandbox API: bearer authentication and derived financial balances.",
};

const ENDPOINTS = [
  ["GET", "/api/v1/accounts", "List synthetic accounts and derived balances."],
  ["GET", "/api/v1/transactions", "List recent transactions, filterable by account."],
  ["GET", "/api/v1/transfers", "List outbound and internal transfers."],
  ["GET", "/api/v1/ledger/journals", "Inspect journals and per-currency balance status."],
  ["GET", "/api/v1/health", "Return ledger integrity and platform health."],
];

const ERRORS = [
  ["401", "unauthorized", "Missing, malformed or revoked API key."],
  ["403", "forbidden", "The key owner lacks access to the resource."],
  ["404", "not_found", "Resource does not exist or is not visible."],
  ["409", "conflict", "State transition is not allowed."],
  ["422", "validation_error", "The request failed a domain invariant."],
  ["429", "rate_limited", "Too many attempts; retry with backoff."],
];

export default function DevelopersPage() {
  return (
    <div className="min-h-dvh bg-background">
      <MarketingNav />
      <main className="mx-auto max-w-[1100px] px-5 py-16 sm:px-8 sm:py-24">
        <div className="grid gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-center">
          <div>
            <Badge variant="violet"><Braces className="h-3 w-3" /> Sandbox API · v1</Badge>
            <h1 className="mt-5 text-[40px] font-semibold leading-[1.05] tracking-[-0.045em] sm:text-[52px]">
              An API that speaks ledger.
            </h1>
            <p className="mt-4 max-w-xl text-[13.5px] leading-relaxed text-muted">
              Read accounts, transactions, transfers and journals with a sandbox bearer key.
              Responses expose derived balances and explicit balance status rather than opaque
              numbers.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild><Link href="/login">Get a sandbox key <ArrowRight className="h-4 w-4" /></Link></Button>
              <Button asChild variant="outline"><Link href="/security">Security notes</Link></Button>
            </div>
          </div>
          <div className="rounded-[16px] border border-border bg-[#08111f] p-4 text-white shadow-float">
            <div className="flex items-center gap-2 border-b border-white/10 pb-3">
              <span className="h-2 w-2 rounded-full bg-[#ff8296]" />
              <span className="h-2 w-2 rounded-full bg-[#f0b45e]" />
              <span className="h-2 w-2 rounded-full bg-[#4bd3a3]" />
              <span className="mono ml-2 text-[9px] text-white/40">curl</span>
            </div>
            <pre className="mono mt-3 overflow-x-auto text-[10px] leading-relaxed text-white/70">
{`curl https://atlas.demo/api/v1/accounts \\
  -H "Authorization: Bearer atlas_sk_sandbox_..."`}
            </pre>
            <div className="mono mt-3 rounded-[8px] border border-white/10 bg-white/[0.03] p-3 text-[9.5px] leading-relaxed text-[#5fdccb]">
{`{
  "data": [
    {
      "id": "acc_maya_usd",
      "currency": "USD",
      "balance_minor": 2016108,
      "held_minor": 0,
      "available_minor": 2016108
    }
  ],
  "meta": { "environment": "sandbox" }
}`}
            </div>
          </div>
        </div>

        <section className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: KeyRound, title: "Bearer keys", body: "Hashed at rest, prefixed atlas_sk_sandbox_, revocable per key." },
            { icon: Repeat2, title: "Idempotency", body: "Transfer submissions carry a client key and request hash." },
            { icon: Radio, title: "Webhooks", body: "Transfer, invoice, card and risk events are persisted for replay." },
            { icon: ShieldCheck, title: "Scoped access", body: "A key inherits its owner's account and organization access only." },
          ].map((item) => (
            <div key={item.title} className="surface-card p-5">
              <item.icon className="h-4.5 w-4.5 text-primary" />
              <p className="mt-3 text-[12.5px] font-semibold">{item.title}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted">{item.body}</p>
            </div>
          ))}
        </section>

        <section className="mt-14">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-teal" />
            <h2 className="text-[20px] font-semibold tracking-tight">Endpoints</h2>
          </div>
          <div className="mt-4 overflow-hidden rounded-[14px] border border-border bg-surface">
            {ENDPOINTS.map(([method, path, description]) => (
              <div key={path} className="grid gap-1 border-b border-border/60 px-5 py-3.5 last:border-0 sm:grid-cols-[60px_1fr_1.1fr] sm:items-center sm:gap-4">
                <span className="mono w-fit rounded bg-teal-soft px-1.5 py-0.5 text-[9px] font-semibold text-teal">{method}</span>
                <span className="mono text-[11px] font-medium">{path}</span>
                <span className="text-[11px] text-muted">{description}</span>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-12 grid gap-4 lg:grid-cols-2">
          <section className="surface-card p-6">
            <h2 className="text-[16px] font-semibold">Authentication</h2>
            <p className="mt-2 text-[12px] leading-relaxed text-muted">
              Send the key as a bearer token. Keys are scoped to the user who created them and to
              the organizations they belong to. The demo key is documented in the business
              developer portal and is intentionally sandbox-only.
            </p>
            <pre className="mono mt-4 overflow-x-auto rounded-[9px] border border-border bg-surface-2 p-3 text-[10.5px] text-muted">
{`Authorization: Bearer atlas_sk_sandbox_demo_7f3c9a2e5b814d06`}
            </pre>
            <p className="mt-2 text-[10.5px] text-subtle">Demo key is read-only and synthetic.</p>
          </section>

          <section className="surface-card p-6">
            <h2 className="text-[16px] font-semibold">Errors</h2>
            <p className="mt-2 text-[12px] leading-relaxed text-muted">
              Errors return a stable machine code plus a human-readable message. Do not branch on
              prose.
            </p>
            <div className="mt-4 space-y-1.5">
              {ERRORS.map(([status, code, description]) => (
                <div key={code} className="flex items-start gap-3 rounded-[7px] px-2 py-1.5 text-[10.5px] odd:bg-surface-2/50">
                  <span className="mono w-7 shrink-0 font-semibold text-danger">{status}</span>
                  <span className="mono w-32 shrink-0 text-foreground">{code}</span>
                  <span className="text-muted">{description}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="mt-12 rounded-[18px] border border-border bg-surface p-6">
          <h2 className="text-[18px] font-semibold tracking-tight">Webhook event shape</h2>
          <p className="mt-2 text-[12px] leading-relaxed text-muted">
            Events are stored in the sandbox and can be replayed from the business developer portal
            or the operations integrations console. Replays are simulated deliveries, not live HTTP
            callbacks.
          </p>
          <pre className="mono mt-4 overflow-x-auto rounded-[10px] border border-border bg-[#08111f] p-4 text-[10.5px] leading-relaxed text-[#9eb0c8]">
{`{
  "id": "wh_6",
  "type": "risk.flagged",
  "created_at": "2026-10-31T08:00:00.000Z",
  "data": { "id": "rsk_2", "severity": "high" },
  "delivery": { "status": "failed", "attempts": 3 }
}`}
          </pre>
        </section>

        <p className="mt-8 text-[10.5px] leading-relaxed text-subtle">
          The API is a sandbox demonstration. It is not a production payment API and must not be
          used to process real funds. Rate limits and key scopes are simplified for the portfolio
          build.
        </p>
      </main>
      <MarketingFooter />
    </div>
  );
}
