import Link from "next/link";
import { AlertTriangle, ShieldAlert, ShieldCheck } from "lucide-react";
import { getDb } from "@/db/client";
import { requireOps } from "@/lib/auth";
import { listRiskEvents } from "@/server/ops";
import { PageHeader, SandboxNote, Panel, Stat, EmptyState, Disclosure } from "@/components/ui/misc";
import { Badge, StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RiskReviewForm } from "@/components/app/ops-forms";
import { cn, formatDateTime, relativeTime } from "@/lib/utils";

export const metadata = { title: "Risk reviews" };

const TABS = [
  { key: "", label: "All" },
  { key: "open", label: "Open" },
  { key: "reviewing", label: "Reviewing" },
  { key: "escalated", label: "Escalated" },
  { key: "cleared", label: "Cleared" },
];

export default async function OpsRiskPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireOps("ops:risk");
  const { status = "" } = await searchParams;
  const db = getDb();
  const events = listRiskEvents(db, status || undefined);
  const all = listRiskEvents(db);
  const critical = all.filter((event) => String(event.severity) === "critical" && ["open", "reviewing"].includes(String(event.status))).length;
  const open = all.filter((event) => String(event.status) === "open").length;
  const reviewing = all.filter((event) => String(event.status) === "reviewing").length;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Operations · trust"
        title="Risk reviews"
        description="Investigate synthetic signals and record an auditable decision. Every outcome requires a note and the authorization PIN."
      />
      <SandboxNote />

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label="Open" value={open} hint="Not yet picked up" icon={<ShieldAlert className="h-4 w-4" />} />
        <Stat label="Reviewing" value={reviewing} hint="Assigned to an analyst" icon={<AlertTriangle className="h-4 w-4" />} />
        <Stat
          label="Critical unresolved"
          value={critical}
          hint="Highest severity"
          icon={<ShieldCheck className="h-4 w-4" />}
          trend={critical > 0 ? <Badge variant="danger">Action</Badge> : <Badge variant="success">Clear</Badge>}
        />
      </section>

      <div className="flex flex-wrap gap-1.5">
        {TABS.map((tab) => (
          <Button
            key={tab.key || "all"}
            asChild
            size="sm"
            variant={status === tab.key ? "primary" : "secondary"}
            className={cn(status === tab.key && "pointer-events-none")}
          >
            <Link href={tab.key ? `/ops/risk?status=${tab.key}` : "/ops/risk"}>{tab.label}</Link>
          </Button>
        ))}
      </div>

      {events.length === 0 ? (
        <EmptyState title="No risk events" description="No events match this filter." icon={<ShieldCheck className="h-5 w-5" />} />
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <Panel
              key={String(event.id)}
              title={String(event.title)}
              description={`${String(event.type).replace(/_/g, " ")} · ${String(event.user_name ?? "Platform")} · ${formatDateTime(String(event.created_at))}`}
              action={
                <div className="flex items-center gap-1.5">
                  <Badge variant={["critical", "high"].includes(String(event.severity)) ? "danger" : "warning"}>{String(event.severity)}</Badge>
                  <StatusPill status={String(event.status)} />
                </div>
              }
            >
              <p className="text-[12px] leading-relaxed text-muted">{String(event.detail)}</p>
              <dl className="mt-3 grid gap-2 text-[10.5px] text-subtle sm:grid-cols-3">
                <div><dt className="font-semibold text-muted">Event</dt><dd className="mono mt-0.5">{String(event.id)}</dd></div>
                <div><dt className="font-semibold text-muted">Assignee</dt><dd className="mt-0.5">{String(event.assignee_name ?? "Unassigned")}</dd></div>
                <div><dt className="font-semibold text-muted">Transfer</dt><dd className="mono mt-0.5">{String(event.transfer_reference ?? "—")}</dd></div>
              </dl>
              {event.status === "cleared" || event.status === "escalated" ? (
                <p className="mt-3 rounded-[9px] border border-border bg-surface-2/50 px-3 py-2 text-[10.5px] text-muted">
                  Closed {event.resolved_at ? relativeTime(String(event.resolved_at)) : "recently"}. Reopen by choosing a new outcome below.
                </p>
              ) : null}
              <details className="mt-3 rounded-[10px] border border-border bg-surface-2/30 p-3">
                <summary className="cursor-pointer text-[11px] font-semibold text-primary">Record a review decision</summary>
                <div className="mt-3">
                  <RiskReviewForm riskId={String(event.id)} />
                </div>
              </details>
            </Panel>
          ))}
        </div>
      )}

      <Disclosure>Risk scores and signals are seeded examples. Clearing an event does not change a customer balance or authorize a payment.</Disclosure>
    </div>
  );
}
