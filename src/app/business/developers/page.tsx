import { Braces, KeyRound, Radio, ShieldCheck, Webhook } from "lucide-react";
import { getDb } from "@/db/client";
import { requireBusiness } from "@/lib/auth";
import { listApiKeys, listWebhooks } from "@/server/ops";
import { PageHeader, SandboxNote, Panel, EmptyState, Disclosure, KeyValue } from "@/components/ui/misc";
import { Badge, StatusPill } from "@/components/ui/badge";
import { CopyButton } from "@/components/ui/copy-button";
import { ApiKeyForm, RevokeKeyButton } from "@/components/app/api-key-form";
import { formatDateTime, safeJson } from "@/lib/utils";

export const metadata = { title: "Developers" };

const ENDPOINTS = [
  ["GET", "/api/v1/accounts", "Accounts with derived ledger and held balances"],
  ["GET", "/api/v1/transactions?account=…", "Owner-scoped transactions"],
  ["GET", "/api/v1/transfers", "Transfers with status and fee fields"],
  ["GET", "/api/v1/ledger/journals", "Journals with per-currency balance checks"],
  ["GET", "/api/v1/health", "Ledger integrity and platform health"],
];

export default async function BusinessDevelopersPage() {
  const ctx = await requireBusiness("dev:manage");
  const db = getDb();
  const keys = listApiKeys(db, ctx.user.id);
  const webhooks = listWebhooks(db).slice(0, 8);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={`Business · ${ctx.orgName}`}
        title="Developers"
        description="Issue sandbox API keys, inspect webhook deliveries and call the read-only v1 API with a bearer token."
      />
      <SandboxNote />

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Panel title="API keys" description="Hashed at rest, scoped to your identity">
          <ApiKeyForm />
          <div className="mt-4 space-y-2">
            {keys.length === 0 ? (
              <EmptyState title="No keys yet" description="Create a key to call the sandbox API." icon={<KeyRound className="h-5 w-5" />} />
            ) : (
              keys.map((key) => (
                <div key={key.id} className="rounded-[10px] border border-border bg-surface px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[11.5px] font-semibold">{key.name}</p>
                      <p className="mono mt-0.5 text-[9.5px] text-subtle">{key.prefix}…</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{key.environment}</Badge>
                      {key.revoked_at ? <StatusPill status="canceled" /> : <StatusPill status="active" />}
                      {key.revoked_at ? null : <RevokeKeyButton keyId={key.id} name={key.name} />}
                    </div>
                  </div>
                  <p className="mt-1 text-[9px] text-subtle">
                    Created {formatDateTime(key.created_at)} · last used {key.last_used_at ? formatDateTime(key.last_used_at) : "never"}
                  </p>
                </div>
              ))
            )}
          </div>
        </Panel>

        <Panel title="Quick start" description="Bearer authentication">
          <div className="rounded-[10px] border border-border bg-[#0c1524] p-3 text-[#d7e2f4]">
            <p className="mono text-[9px] uppercase tracking-[0.14em] text-[#7f93b3]">shell</p>
            <pre className="mono mt-2 overflow-x-auto text-[10px] leading-relaxed">{`curl -s http://localhost:3000/api/v1/accounts \\
  -H "Authorization: Bearer atlas_sk_sandbox_…"`}</pre>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <CopyButton value={'curl -s http://localhost:3000/api/v1/accounts -H "Authorization: Bearer atlas_sk_sandbox_…"'} label="Copy example" variant="secondary" size="sm" />
            <span className="text-[10px] text-subtle">Read-only · sandbox only</span>
          </div>
          <dl className="mt-4 divide-y divide-border/70">
            <KeyValue label="Base URL" value={<span className="mono text-[10.5px]">/api/v1</span>} />
            <KeyValue label="Auth" value={<span className="mono text-[10.5px]">Bearer &lt;key&gt;</span>} />
            <KeyValue label="Format" value={<span className="mono text-[10.5px]">application/json</span>} />
            <KeyValue label="Rate limit" value="120 req / minute / key" />
          </dl>
        </Panel>
      </section>

      <Panel title="Endpoints" description="Implemented in this repository">
        <div className="space-y-2">
          {ENDPOINTS.map(([method, path, description]) => (
            <div key={path} className="flex flex-col gap-1 rounded-[9px] border border-border bg-surface px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3">
              <Badge variant="success" className="w-fit">{method}</Badge>
              <code className="mono text-[10.5px] text-foreground">{path}</code>
              <span className="text-[10.5px] text-muted sm:ml-auto">{description}</span>
            </div>
          ))}
        </div>
      </Panel>

      <section className="grid gap-4 lg:grid-cols-2">
        <Panel title="Webhook deliveries" description="Local queue, not a live endpoint">
          {webhooks.length === 0 ? (
            <EmptyState title="No webhook events" icon={<Webhook className="h-5 w-5" />} />
          ) : (
            <div className="space-y-2">
              {webhooks.map((event) => {
                const payload = safeJson<Record<string, unknown>>(String(event.payload ?? "{}"), {});
                return (
                  <div key={String(event.id)} className="rounded-[9px] border border-border bg-surface px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="mono text-[10.5px] font-semibold">{String(event.type)}</p>
                      <StatusPill status={String(event.status)} />
                    </div>
                    <p className="mt-1 truncate text-[9.5px] text-subtle">
                      {formatDateTime(String(event.created_at))} · attempts {String(event.attempts)} · {Object.keys(payload).length} fields
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel title="Security model" description="What the sandbox API will not do">
          <ul className="space-y-3">
            {[
              [ShieldCheck, "Read-only surface", "v1 exposes reads only. There is no endpoint that moves money."],
              [KeyRound, "Hashed secrets", "Keys are stored as SHA-256 hashes with a visible prefix for identification."],
              [Radio, "Owner scoping", "Responses are scoped to the key owner and their organization memberships."],
              [Braces, "Stable errors", "Errors return a machine-readable code and a human message."],
            ].map(([Icon, title, body]) => {
              const Component = Icon as typeof ShieldCheck;
              return (
                <li key={String(title)} className="flex gap-2.5">
                  <Component className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  <div>
                    <p className="text-[11px] font-semibold">{String(title)}</p>
                    <p className="mt-0.5 text-[10px] leading-relaxed text-muted">{String(body)}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      </section>

      <Disclosure>API keys and webhooks are sandbox-only. Do not use demo keys against production systems.</Disclosure>
    </div>
  );
}
