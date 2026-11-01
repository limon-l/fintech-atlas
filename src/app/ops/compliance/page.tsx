import Link from "next/link";
import { FileCheck2, ShieldCheck, UserRoundSearch } from "lucide-react";
import { getDb } from "@/db/client";
import { requireOps } from "@/lib/auth";
import { listComplianceCases } from "@/server/ops";
import { PageHeader, SandboxNote, Panel, Stat, EmptyState, Disclosure } from "@/components/ui/misc";
import { Badge, StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ComplianceReviewForm } from "@/components/app/ops-forms";
import { cn, formatDateTime } from "@/lib/utils";

export const metadata = { title: "Compliance cases" };

const TABS = [
  { key: "", label: "All" },
  { key: "open", label: "Open" },
  { key: "reviewing", label: "Reviewing" },
  { key: "info_requested", label: "Info requested" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];

export default async function OpsCompliancePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireOps("ops:compliance");
  const { status = "" } = await searchParams;
  const db = getDb();
  const cases = listComplianceCases(db, status || undefined);
  const all = listComplianceCases(db);
  const open = all.filter((item) => ["open", "reviewing", "info_requested"].includes(String(item.status))).length;
  const high = all.filter((item) => String(item.priority) === "high" && ["open", "reviewing", "info_requested"].includes(String(item.status))).length;
  const decided = all.filter((item) => ["approved", "rejected"].includes(String(item.status))).length;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Operations · trust"
        title="Compliance cases"
        description="Synthetic KYC, KYB, AML and dispute reviews. Decisions require evidence notes and the authorization PIN. No regulatory certification is implied."
      />
      <SandboxNote />

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label="Open caseload" value={open} hint="Open, reviewing or awaiting info" icon={<UserRoundSearch className="h-4 w-4" />} />
        <Stat label="High priority" value={high} hint="Needs senior attention" icon={<ShieldCheck className="h-4 w-4" />} trend={high > 0 ? <Badge variant="warning">Priority</Badge> : <Badge variant="success">Clear</Badge>} />
        <Stat label="Decided" value={decided} hint="Approved or rejected" icon={<FileCheck2 className="h-4 w-4" />} />
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
            <Link href={tab.key ? `/ops/compliance?status=${tab.key}` : "/ops/compliance"}>{tab.label}</Link>
          </Button>
        ))}
      </div>

      {cases.length === 0 ? (
        <EmptyState title="No compliance cases" description="No cases match this filter." icon={<ShieldCheck className="h-5 w-5" />} />
      ) : (
        <div className="space-y-3">
          {cases.map((item) => (
            <Panel
              key={String(item.id)}
              title={`${String(item.type).toUpperCase()} · ${String(item.subject_name ?? item.subject_id)}`}
              description={`${String(item.subject_type)} case · opened ${formatDateTime(String(item.created_at))}`}
              action={
                <div className="flex items-center gap-1.5">
                  <Badge variant={String(item.priority) === "high" ? "danger" : String(item.priority) === "low" ? "neutral" : "warning"}>{String(item.priority)}</Badge>
                  <StatusPill status={String(item.status)} />
                </div>
              }
            >
              <p className="text-[12px] leading-relaxed text-muted">{String(item.summary)}</p>
              <dl className="mt-3 grid gap-2 text-[10.5px] text-subtle sm:grid-cols-3">
                <div><dt className="font-semibold text-muted">Case</dt><dd className="mono mt-0.5">{String(item.id)}</dd></div>
                <div><dt className="font-semibold text-muted">Assignee</dt><dd className="mt-0.5">{String(item.assignee_name ?? "Unassigned")}</dd></div>
                <div><dt className="font-semibold text-muted">Last update</dt><dd className="mt-0.5">{formatDateTime(String(item.updated_at))}</dd></div>
              </dl>
              <details className="mt-3 rounded-[10px] border border-border bg-surface-2/30 p-3">
                <summary className="cursor-pointer text-[11px] font-semibold text-primary">Record a case decision</summary>
                <div className="mt-3">
                  <ComplianceReviewForm caseId={String(item.id)} />
                </div>
              </details>
            </Panel>
          ))}
        </div>
      )}

      <Disclosure>Compliance records are synthetic. They demonstrate case handling and auditability, not real regulatory controls.</Disclosure>
    </div>
  );
}
