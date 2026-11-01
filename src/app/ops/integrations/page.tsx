import { Activity, Cable, Webhook } from "lucide-react";
import { getDb } from "@/db/client";
import { requireOps } from "@/lib/auth";
import { listProviderEvents, listWebhooks } from "@/server/ops";
import { PageHeader, SandboxNote, Panel, Stat, EmptyState, Disclosure } from "@/components/ui/misc";
import { Badge, StatusPill } from "@/components/ui/badge";
import { WebhookReplayButton } from "@/components/app/ops-forms";
import { formatDateTime, relativeTime, safeJson } from "@/lib/utils";

export const metadata = { title: "Integrations" };

export default async function OpsIntegrationsPage() {
  await requireOps("dev:manage");
  const db = getDb();
  const providerEvents = listProviderEvents(db);
  const webhooks = listWebhooks(db);
  const failed = webhooks.filter((event) => String(event.status) === "failed").length;
  const delivered = webhooks.filter((event) => String(event.status) === "delivered").length;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Operations · platform"
        title="Integrations"
        description="Synthetic provider events and the local webhook queue. Replaying a delivery records an audit event; it does not call an external endpoint."
      />
      <SandboxNote />

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label="Provider events" value={providerEvents.length} hint="Synthetic payout lifecycle" icon={<Cable className="h-4 w-4" />} />
        <Stat label="Webhooks delivered" value={delivered} hint="Local queue only" icon={<Webhook className="h-4 w-4" />} />
        <Stat
          label="Failed deliveries"
          value={failed}
          hint="Safe to replay"
          icon={<Activity className="h-4 w-4" />}
          trend={failed > 0 ? <Badge variant="danger">Retry</Badge> : <Badge variant="success">Healthy</Badge>}
        />
      </section>

      <Panel title="Provider events" description="Settlement and processing signals" bodyClassName="p-0">
        {providerEvents.length === 0 ? (
          <EmptyState title="No provider events" className="m-5" />
        ) : (
          <div className="divide-y divide-border/70">
            {providerEvents.map((event) => (
              <div key={String(event.id)} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="mono text-[10.5px] font-semibold">{String(event.event_type)}</p>
                    <StatusPill status={String(event.status)} />
                  </div>
                  <p className="mt-0.5 text-[9.5px] text-subtle">
                    {String(event.provider_ref)} · transfer {String(event.transfer_reference ?? "—")} · {formatDateTime(String(event.created_at))}
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-[11.5px] font-semibold">{Number(event.amount_minor).toLocaleString()} minor</p>
                  <p className="text-[9.5px] text-subtle">{String(event.currency)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Webhook queue" description="Deterministic local delivery log">
        {webhooks.length === 0 ? (
          <EmptyState title="No webhook events" icon={<Webhook className="h-5 w-5" />} />
        ) : (
          <div className="space-y-2">
            {webhooks.map((event) => {
              const payload = safeJson<Record<string, unknown>>(String(event.payload ?? "{}"), {});
              return (
                <div key={String(event.id)} className="flex flex-col gap-2 rounded-[10px] border border-border bg-surface px-3 py-2.5 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="mono text-[10.5px] font-semibold">{String(event.type)}</p>
                      <StatusPill status={String(event.status)} />
                    </div>
                    <p className="mt-0.5 text-[9.5px] text-subtle">
                      {relativeTime(String(event.created_at))} · attempts {String(event.attempts)} · {Object.keys(payload).length} payload fields
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="mono text-[9px]">{String(event.id)}</Badge>
                    <WebhookReplayButton webhookId={String(event.id)} status={String(event.status)} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      <Disclosure>No live payment, KYC or messaging provider is connected. Events and deliveries are generated locally for demonstration.</Disclosure>
    </div>
  );
}
