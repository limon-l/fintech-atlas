import { FileText, Search, ShieldCheck, UserRound } from "lucide-react";
import { getDb } from "@/db/client";
import { requireOps } from "@/lib/auth";
import { listAudit } from "@/server/ops";
import { PageHeader, SandboxNote, Panel, Stat, EmptyState, Disclosure } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime, safeJson } from "@/lib/utils";

export const metadata = { title: "Audit trail" };

const RESOURCE_TYPES = [
  "user",
  "session",
  "account",
  "transfer",
  "journal_entry",
  "risk_event",
  "compliance_case",
  "reconciliation_run",
  "reconciliation_item",
  "support_ticket",
  "webhook_event",
  "api_key",
  "approval_request",
];

export default async function OpsAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; resource?: string }>;
}) {
  await requireOps("audit:read");
  const { q = "", resource = "" } = await searchParams;
  const db = getDb();
  const events = listAudit(db, { action: q || undefined, resourceType: resource || undefined, limit: 200 });
  const actors = new Set(events.map((event) => event.actorId).filter(Boolean)).size;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Operations · proof"
        title="Audit trail"
        description="Persistent records of sandbox decisions. Every login, transfer, approval, reconciliation and correction writes an immutable event."
      />
      <SandboxNote />

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label="Events shown" value={events.length} hint="Most recent first" icon={<FileText className="h-4 w-4" />} />
        <Stat label="Distinct actors" value={actors} hint="In this view" icon={<UserRound className="h-4 w-4" />} />
        <Stat label="Immutable" value="Append-only" hint="No update or delete path" icon={<ShieldCheck className="h-4 w-4" />} />
      </section>

      <form className="grid gap-2 sm:grid-cols-[1fr_auto_auto]" action="/ops/audit">
        <div>
          <label className="sr-only" htmlFor="audit-search">Search actions</label>
          <Input id="audit-search" name="q" defaultValue={q} placeholder="Filter by action, e.g. transfer or risk…" />
        </div>
        <div>
          <label className="sr-only" htmlFor="audit-resource">Resource type</label>
          <Select id="audit-resource" name="resource" defaultValue={resource}>
            <option value="">All resources</option>
            {RESOURCE_TYPES.map((type) => <option key={type} value={type}>{type.replace(/_/g, " ")}</option>)}
          </Select>
        </div>
        <SubmitButton variant="secondary">
          <Search className="h-3.5 w-3.5" /> Filter
        </SubmitButton>
      </form>

      <Panel title="Event log" description={`${events.length} matching events`} bodyClassName="p-0">
        {events.length === 0 ? (
          <EmptyState title="No audit events" description="No events match this filter." className="m-5" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Resource</TableHead>
                <TableHead>Metadata</TableHead>
                <TableHead>Request</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((event) => {
                const metadata = safeJson<Record<string, unknown>>(event.metadata, {});
                return (
                  <TableRow key={event.id}>
                    <TableCell>
                      <p className="mono text-[10.5px] font-semibold">{event.action}</p>
                      {event.actorRole ? <Badge variant="outline" className="mt-1">{event.actorRole.replace(/_/g, " ")}</Badge> : null}
                    </TableCell>
                    <TableCell className="text-[10.5px]">
                      {event.actorName ?? "System"}
                      <p className="mono mt-0.5 text-[9px] text-subtle">{event.actorId ?? "—"}</p>
                    </TableCell>
                    <TableCell className="text-[10.5px]">
                      {event.resourceType.replace(/_/g, " ")}
                      <p className="mono mt-0.5 max-w-[160px] truncate text-[9px] text-subtle">{event.resourceId ?? "—"}</p>
                    </TableCell>
                    <TableCell className="max-w-[220px]">
                      <code className="mono block max-h-16 overflow-auto break-words rounded bg-surface-2 px-2 py-1 text-[9px] text-muted">
                        {Object.keys(metadata).length === 0 ? "{}" : JSON.stringify(metadata)}
                      </code>
                    </TableCell>
                    <TableCell className="mono max-w-[120px] truncate text-[9px] text-subtle">{event.requestId ?? "—"}</TableCell>
                    <TableCell className="text-[10px] text-subtle">{formatDateTime(event.createdAt)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Panel>

      <Disclosure>Audit events are synthetic and local. They demonstrate traceability for the sandbox, not a production compliance archive.</Disclosure>
    </div>
  );
}
