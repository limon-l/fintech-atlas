import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOps } from "@/lib/auth";
import { getDb } from "@/db/client";
import * as ops from "@/server/ops";
import { PageHeader, SandboxNote, Panel } from "@/components/ui/misc";
import { OpsTable } from "@/components/app/ops-table";
import { SubmitButton } from "@/components/ui/submit-button";
import { platformPermissions, businessPermissions, type Permission, type PlatformRole, type BusinessRole } from "@/domain/rbac";

const views: Record<string, { title: string; permission: Permission; description: string }> = {
  customers: { title: "Customers", permission: "ops:read", description: "Synthetic customer identities and account counts." },
  support: { title: "Support queue", permission: "ops:read", description: "Sandbox support tickets and their current status." },
  risk: { title: "Risk reviews", permission: "ops:risk", description: "Investigate signals and record an auditable decision." },
  compliance: { title: "Compliance cases", permission: "ops:compliance", description: "Synthetic KYC, KYB and AML review cases. No regulatory certification is implied." },
  reconciliation: { title: "Reconciliation", permission: "ops:reconcile", description: "Compare posted external payouts with synthetic provider settlements. All amounts below are integer minor units." },
  ledger: { title: "Ledger inspector", permission: "ops:ledger", description: "Immutable journal records, posting counts and per-currency balance checks." },
  audit: { title: "Audit trail", permission: "audit:read", description: "Persistent, immutable records of sandbox decisions." },
  integrations: { title: "Provider events", permission: "dev:manage", description: "Synthetic provider events only. No live financial integrations are configured." },
  health: { title: "System health", permission: "ops:read", description: "Current local database and sandbox integrity checks." },
  permissions: { title: "Roles & permissions", permission: "ops:admin", description: "Explicit platform and organization permissions. Resource ownership is checked separately." },
};

async function reconcile() {
  "use server";
  const actor = await requireOps("ops:reconcile");
  ops.runReconciliation(getDb(), actor);
  revalidatePath("/ops/reconciliation");
}

async function review(data: FormData) {
  "use server";
  const input = z.object({ kind: z.enum(["risk", "compliance"]), id: z.string().min(1), status: z.string(), note: z.string().trim().min(1).max(2000) }).parse(Object.fromEntries(data));
  const actor = await requireOps(input.kind === "risk" ? "ops:risk" : "ops:compliance");
  if (input.kind === "risk") ops.updateRiskEvent(getDb(), actor, { riskId: input.id, status: z.enum(["reviewing", "cleared", "escalated"]).parse(input.status), note: input.note });
  else ops.updateComplianceCase(getDb(), actor, { caseId: input.id, status: z.enum(["reviewing", "info_requested", "approved", "rejected"]).parse(input.status), note: input.note });
  revalidatePath(`/ops/${input.kind}`);
}

export default async function OperationsView({ params, searchParams }: { params: Promise<{ view: string }>; searchParams: Promise<{ q?: string }> }) {
  const { view } = await params;
  const config = views[view];
  if (!config) notFound();
  await requireOps(config.permission);
  const db = getDb();
  const { q = "" } = await searchParams;
  let rows: object[] = [];
  switch (view) {
    case "customers": rows = ops.listCustomers(db, q); break;
    case "support": rows = ops.listSupportTickets(db); break;
    case "risk": rows = ops.listRiskEvents(db); break;
    case "compliance": rows = ops.listComplianceCases(db); break;
    case "reconciliation": rows = ops.getLatestReconciliation(db).items; break;
    case "ledger": rows = ops.listJournals(db, { search: q }); break;
    case "audit": rows = ops.listAudit(db, { limit: 100 }); break;
    case "integrations": rows = ops.listProviderEvents(db); break;
    case "health": rows = Object.entries(ops.getSystemHealth(db)).map(([check, value]) => ({ check, value })); break;
    case "permissions": rows = [ ...(["customer", "support", "risk", "compliance", "admin", "super_admin"] as PlatformRole[]).map(role => ({ scope: "platform", role, permissions: platformPermissions(role).join(", ") })), ...(["owner", "finance_manager", "approver", "employee"] as BusinessRole[]).map(role => ({ scope: "organization", role, permissions: businessPermissions(role).join(", ") })) ]; break;
  }
  const reviewable = view === "risk" || view === "compliance";
  return <div className="space-y-5"><PageHeader eyebrow="Operations" title={config.title} description={config.description} /><SandboxNote />{["customers", "ledger"].includes(view) && <form className="flex gap-2"><label className="sr-only" htmlFor="ops-search">Search records</label><input id="ops-search" name="q" defaultValue={q} placeholder="Search records…" className="rounded-lg border border-border bg-surface px-3 py-2 text-sm" /><SubmitButton>Search</SubmitButton></form>}{view === "reconciliation" && <form action={reconcile}><SubmitButton pendingLabel="Reconciling…">Run sandbox reconciliation</SubmitButton></form>}<OpsTable rows={rows} />{reviewable && rows.length > 0 && <Panel title="Record a review decision"><form action={review} className="grid max-w-xl gap-3"><input type="hidden" name="kind" value={view} /><label className="grid gap-1 text-sm">Case<select required name="id" className="rounded-lg border border-border bg-surface p-2">{(rows as Record<string, unknown>[]).map(row => <option key={String(row.id)} value={String(row.id)}>{String(row.title ?? row.summary ?? row.id)}</option>)}</select></label><label className="grid gap-1 text-sm">Decision<select name="status" className="rounded-lg border border-border bg-surface p-2">{(view === "risk" ? ["reviewing", "cleared", "escalated"] : ["reviewing", "info_requested", "approved", "rejected"]).map(status => <option key={status}>{status}</option>)}</select></label><label className="grid gap-1 text-sm">Review notes<textarea required maxLength={2000} name="note" className="rounded-lg border border-border bg-surface p-2" /></label><SubmitButton>Save audited decision</SubmitButton></form></Panel>}</div>;
}
