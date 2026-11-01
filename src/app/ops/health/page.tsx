import { Activity, CheckCircle2, Database, Server, ShieldCheck } from "lucide-react";
import { getDb } from "@/db/client";
import { requireOps } from "@/lib/auth";
import { getSystemHealth } from "@/server/ops";
import { PageHeader, SandboxNote, Panel, Stat, KeyValue, Disclosure, Dot } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "System health" };

function bytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function OpsHealthPage() {
  await requireOps("ops:read");
  const health = getSystemHealth(getDb());
  const checks = [
    { label: "SQLite integrity", value: health.database, ok: health.database === "ok" },
    { label: "Unbalanced journals", value: health.unbalancedJournals, ok: health.unbalancedJournals === 0 },
    { label: "Failed webhooks", value: health.failedWebhooks, ok: health.failedWebhooks === 0 },
    { label: "Active sessions", value: health.counts.sessions, ok: true },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Operations · platform"
        title="System health"
        description="Local database integrity, ledger balance checks and runtime information. This is a sandbox deployment, not a production SLA."
      />
      <SandboxNote />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Database" value={health.database} hint={`${bytes(health.sizeBytes)} on disk`} icon={<Database className="h-4 w-4" />} trend={<Badge variant={health.database === "ok" ? "success" : "danger"}>{health.database === "ok" ? "Healthy" : "Check"}</Badge>} />
        <Stat label="Users" value={health.counts.users} hint={`${health.counts.sessions} active sessions`} icon={<Server className="h-4 w-4" />} />
        <Stat label="Ledger" value={health.counts.journals} hint={`${health.counts.postings} postings`} icon={<ShieldCheck className="h-4 w-4" />} trend={<Badge variant={health.unbalancedJournals === 0 ? "success" : "danger"}>{health.unbalancedJournals === 0 ? "Balanced" : "Unbalanced"}</Badge>} />
        <Stat label="Uptime" value={`${Math.floor(health.uptimeSeconds / 60)}m`} hint={health.nodeVersion} icon={<Activity className="h-4 w-4" />} />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Panel title="Integrity checks" description="Evaluated on this request">
          <ul className="divide-y divide-border/70">
            {checks.map((check) => (
              <li key={check.label} className="flex items-center justify-between gap-3 py-3">
                <span className="flex items-center gap-2 text-[12px]">
                  <Dot tone={check.ok ? "success" : "danger"} />
                  {check.label}
                </span>
                <span className="flex items-center gap-2 text-[11px] font-semibold">
                  {String(check.value)}
                  {check.ok ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : <Badge variant="danger">Attention</Badge>}
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Runtime" description="Generated for this request">
          <dl className="divide-y divide-border/70">
            <KeyValue label="Node.js" value={health.nodeVersion} mono />
            <KeyValue label="Database size" value={bytes(health.sizeBytes)} />
            <KeyValue label="Accounts" value={health.counts.accounts} />
            <KeyValue label="Journals" value={health.counts.journals} />
            <KeyValue label="Postings" value={health.counts.postings} />
            <KeyValue label="Generated" value={formatDateTime(health.generatedAt)} />
          </dl>
        </Panel>
      </section>

      <Disclosure>Health checks run against the local SQLite file. A green status here does not imply production availability, backups or disaster recovery.</Disclosure>
    </div>
  );
}
