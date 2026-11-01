import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  BookOpenCheck,
  Gauge,
  Landmark,
  ShieldAlert,
  ShieldCheck,
  Users,
  Webhook,
} from "lucide-react";
import { getDb } from "@/db/client";
import { requireOps } from "@/lib/auth";
import { canPlatform } from "@/domain/rbac";
import { getLatestReconciliation, getOpsOverview, listComplianceCases, listRiskEvents } from "@/server/ops";
import { PageHeader, SandboxNote, Stat, Panel, EmptyState, Dot, Disclosure } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { NAV } from "@/components/app/nav-config";
import { relativeTime } from "@/lib/utils";

export const metadata = { title: "Operations" };

export default async function OperationsPage() {
  const user = await requireOps();
  const db = getDb();
  const overview = getOpsOverview(db);
  const risks = listRiskEvents(db).filter((row) => ["open", "reviewing"].includes(String(row.status))).slice(0, 4);
  const cases = listComplianceCases(db)
    .filter((row) => ["open", "reviewing", "info_requested"].includes(String(row.status)))
    .slice(0, 4);
  const reconciliation = getLatestReconciliation(db);
  const exceptions = reconciliation.items.filter((item) => item.status === "exception").slice(0, 3);
  const items = NAV.ops.flatMap((group) => group.items).filter((item) => item.href !== "/ops");

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Trust & operations"
        title="Every movement. Accounted for."
        description="Inspect the sandbox, investigate exceptions and follow the audit trail. Platform staff can review records but cannot move customer funds."
      />
      <SandboxNote />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Customers"
          value={overview.customers}
          hint={`${overview.accounts} simulated accounts · ${overview.organizations} orgs`}
          icon={<Users className="h-4 w-4" />}
        />
        <Stat
          label="Open risk events"
          value={overview.openRisk}
          hint={`${overview.criticalRisk} critical · ${overview.pendingCases} compliance cases`}
          icon={<ShieldAlert className="h-4 w-4" />}
          trend={overview.criticalRisk > 0 ? <Badge variant="danger">Critical</Badge> : <Badge variant="success">Stable</Badge>}
        />
        <Stat
          label="Posted journals"
          value={overview.journals}
          hint={`${overview.postings} immutable postings`}
          icon={<BookOpenCheck className="h-4 w-4" />}
        />
        <Stat
          label="Reconciliation"
          value={overview.reconciliationExceptions}
          hint={reconciliation.run ? `Latest run ${relativeTime(reconciliation.run.startedAt)}` : "No run yet"}
          icon={<Landmark className="h-4 w-4" />}
          trend={
            overview.reconciliationExceptions > 0 ? (
              <Badge variant="warning">Needs review</Badge>
            ) : (
              <Badge variant="success">Balanced</Badge>
            )
          }
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel
          title="Attention queue"
          description="Signals that need a human decision"
          action={
            <Badge variant={risks.length + cases.length + exceptions.length > 0 ? "warning" : "success"}>
              {risks.length + cases.length + exceptions.length} open
            </Badge>
          }
        >
          {risks.length + cases.length + exceptions.length === 0 ? (
            <EmptyState title="Queue is clear" description="No open risk, compliance or reconciliation items." icon={<ShieldCheck className="h-5 w-5" />} />
          ) : (
            <ul className="space-y-2">
              {risks.map((risk) => (
                <li key={String(risk.id)}>
                  <Link
                    href="/ops/risk"
                    className="flex items-start gap-3 rounded-[10px] border border-border bg-surface px-3 py-2.5 transition-colors hover:bg-surface-2"
                  >
                    <span className="mt-1"><Dot tone={String(risk.severity) === "critical" || String(risk.severity) === "high" ? "danger" : "warning"} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-[11.5px] font-semibold">{String(risk.title)}</span>
                        <Badge variant="outline">{String(risk.severity)}</Badge>
                      </span>
                      <span className="mt-0.5 block text-[10px] text-subtle">Risk · {String(risk.user_name ?? "Platform")} · {relativeTime(String(risk.created_at))}</span>
                    </span>
                    <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-subtle" />
                  </Link>
                </li>
              ))}
              {cases.map((item) => (
                <li key={String(item.id)}>
                  <Link
                    href="/ops/compliance"
                    className="flex items-start gap-3 rounded-[10px] border border-border bg-surface px-3 py-2.5 transition-colors hover:bg-surface-2"
                  >
                    <span className="mt-1"><Dot tone="info" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-[11.5px] font-semibold">{String(item.type).toUpperCase()} · {String(item.subject_name ?? item.subject_id)}</span>
                        <Badge variant="outline">{String(item.priority)}</Badge>
                      </span>
                      <span className="mt-0.5 block text-[10px] text-subtle">Compliance · {String(item.summary)}</span>
                    </span>
                    <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-subtle" />
                  </Link>
                </li>
              ))}
              {exceptions.map((item) => (
                <li key={item.id}>
                  <Link
                    href="/ops/reconciliation"
                    className="flex items-start gap-3 rounded-[10px] border border-warning/25 bg-warning-soft/40 px-3 py-2.5 transition-colors hover:bg-warning-soft/70"
                  >
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-[11.5px] font-semibold">{item.currency} reconciliation exception</span>
                        <Badge variant="warning">{item.differenceMinor.toLocaleString()} minor</Badge>
                      </span>
                      <span className="mt-0.5 block text-[10px] text-warning/80">{item.note}</span>
                    </span>
                    <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Platform pulse" description="Local sandbox state">
          <dl className="divide-y divide-border/70">
            {[
              ["Ledger volume (USD posted)", `$${(overview.volumeUsdMinor / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
              ["Pending approvals", overview.pendingApprovals],
              ["Failed provider events", overview.failedProviderEvents],
              ["Last reconciliation", overview.lastReconciliation?.completedAt ? relativeTime(overview.lastReconciliation.completedAt) : "Never"],
              ["Database", "SQLite · local file"],
            ].map(([label, value]) => (
              <div key={String(label)} className="flex items-center justify-between gap-4 py-2.5">
                <dt className="text-[12px] text-muted">{label}</dt>
                <dd className="text-right text-[12px] font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
          <Link
            href="/ops/health"
            className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
          >
            Open health checks <ArrowUpRight className="h-3 w-3" />
          </Link>
        </Panel>
      </section>

      <Panel title="Operations workspace" description="Each view is scoped by a server-enforced permission">
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="group flex items-center gap-3 rounded-[11px] border border-border bg-surface px-3.5 py-3 transition-colors hover:border-border-strong hover:bg-surface-2"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-surface-2 text-muted group-hover:text-primary">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1 text-[12px] font-semibold">{item.label}</span>
                <ArrowUpRight className="h-3.5 w-3.5 text-subtle transition-colors group-hover:text-primary" />
              </Link>
            );
          })}
        </div>
      </Panel>

      {canPlatform(user.platformRole, "audit:read") ? (
        <Panel title="Recent audit activity" description="Immutable records of sandbox decisions" action={<Link href="/ops/audit" className="text-[11px] font-semibold text-primary hover:underline">Full trail</Link>}>
          {overview.recentAudit.length === 0 ? (
            <EmptyState title="No audit events" />
          ) : (
            <ul className="divide-y divide-border/70">
              {overview.recentAudit.map((event) => (
                <li key={event.id} className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="mono text-[10.5px] font-semibold">{event.action}</p>
                    <p className="mt-0.5 text-[10px] text-subtle">
                      {event.actorName ?? "System"} · {event.resourceType}{event.resourceId ? ` · ${event.resourceId}` : ""}
                    </p>
                  </div>
                  <span className="text-[10px] text-subtle">{relativeTime(event.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="outline"><Gauge className="h-3 w-3" /> {user.platformRole.replace("_", " ")}</Badge>
        <Badge variant="outline"><Webhook className="h-3 w-3" /> Sandbox integrations</Badge>
        <Disclosure className="max-w-2xl">Operations data is synthetic. Risk, compliance and reconciliation decisions are audit exercises, not regulatory certifications.</Disclosure>
      </div>
    </div>
  );
}
