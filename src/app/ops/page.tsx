import Link from "next/link";
import { requireOps } from "@/lib/auth";
import { getDb } from "@/db/client";
import { getOpsOverview } from "@/server/ops";
import { PageHeader, SandboxNote, Stat, Panel } from "@/components/ui/misc";
import { OpsTable } from "@/components/app/ops-table";
import { NAV } from "@/components/app/nav-config";
import { canPlatform } from "@/domain/rbac";

export default async function OperationsPage() {
  const user = await requireOps();
  const overview = getOpsOverview(getDb());
  return <div className="space-y-5"><PageHeader eyebrow="Trust & operations" title="Every movement. Accounted for." description="Inspect the sandbox, investigate exceptions, and follow the audit trail." /><SandboxNote /><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Stat label="Customers" value={overview.customers} hint={`${overview.accounts} simulated accounts`} /><Stat label="Open risk events" value={overview.openRisk} hint={`${overview.criticalRisk} critical`} /><Stat label="Posted journals" value={overview.journals} hint={`${overview.postings} ledger postings`} /><Stat label="Reconciliation exceptions" value={overview.reconciliationExceptions} hint="Latest sandbox run" /></div><Panel title="Operations workspace"><div className="grid gap-3 sm:grid-cols-3">{NAV.ops.flatMap(group => group.items).filter(item => item.href !== "/ops").map(item => <Link className="rounded-xl border border-border p-4 text-sm hover:bg-surface-2" key={item.href} href={item.href}>{item.label} <span aria-hidden="true">↗</span></Link>)}</div></Panel>{canPlatform(user.platformRole, "audit:read") && <Panel title="Recent audit activity"><OpsTable rows={overview.recentAudit} /></Panel>}</div>;
}
