import Link from "next/link";
import { CheckCircle2, Clock, ListChecks, XCircle } from "lucide-react";
import { getDb } from "@/db/client";
import { requireBusiness } from "@/lib/auth";
import { listApprovals } from "@/server/business";
import { PageHeader, SandboxNote, Panel, Stat, EmptyState, Disclosure } from "@/components/ui/misc";
import { Money } from "@/components/ui/money";
import { StatusPill, Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, relativeTime } from "@/lib/utils";

export const metadata = { title: "Approvals" };

const TABS = [
  { key: "", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const status = typeof query.status === "string" ? query.status : "";
  const ctx = await requireBusiness("approval:read");
  const db = getDb();
  const actor = { user: ctx.user, orgId: ctx.orgId, role: ctx.role };
  const approvals = listApprovals(db, actor, status || undefined);
  const all = listApprovals(db, actor);
  const pending = all.filter((approval) => approval.status === "pending");
  const myTurn = pending.filter((approval) => approval.myTurn);
  const currency = approvals[0]?.currency ?? ctx.baseCurrency;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Business · controls"
        title="Approvals"
        description="Two-step maker-checker: an approver, then a finance manager. Self-approval is blocked and every decision needs a PIN."
      />
      <SandboxNote />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Pending" value={pending.length} hint={<Money amountMinor={pending.reduce((acc, approval) => acc + approval.amountMinor, 0)} currency={currency} />} icon={<Clock className="h-4 w-4" />} />
        <Stat label="Your turn" value={myTurn.length} hint="Requests you can decide" icon={<ListChecks className="h-4 w-4" />} trend={myTurn.length > 0 ? <Badge variant="primary">Action</Badge> : <Badge variant="success">Clear</Badge>} />
        <Stat label="Approved" value={all.filter((approval) => approval.status === "approved").length} hint="Fully approved" icon={<CheckCircle2 className="h-4 w-4" />} />
        <Stat label="Rejected" value={all.filter((approval) => approval.status === "rejected").length} hint="Stopped at a step" icon={<XCircle className="h-4 w-4" />} />
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
            <Link href={tab.key ? `/business/approvals?status=${tab.key}` : "/business/approvals"}>{tab.label}</Link>
          </Button>
        ))}
      </div>

      <Panel title="Requests" description={`${approvals.length} in this view`}>
        {approvals.length === 0 ? (
          <EmptyState title="Nothing here" description="No approval requests match this filter." />
        ) : (
          <div className="space-y-2">
            {approvals.map((approval) => (
              <Link
                key={approval.id}
                href={`/business/approvals/${approval.id}`}
                className="flex flex-col gap-2 rounded-[11px] border border-border bg-surface px-3.5 py-3 transition-colors hover:bg-surface-2 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[12.5px] font-semibold">{approval.title}</p>
                    <Badge variant="outline">{approval.type}</Badge>
                    {approval.myTurn ? <Badge variant="primary">Your turn</Badge> : null}
                  </div>
                  <p className="mt-0.5 text-[10px] text-subtle">
                    {approval.requestedByName} · {relativeTime(approval.createdAt)} · step {approval.currentStep} of {approval.totalSteps}
                  </p>
                </div>
                <div className="flex items-center gap-3 sm:justify-end">
                  <Money amountMinor={approval.amountMinor} currency={approval.currency} className="text-[12.5px] font-semibold" />
                  <StatusPill status={approval.status} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </Panel>

      <Disclosure>Approval records are synthetic workflow artefacts. They do not authorize real payments.</Disclosure>
    </div>
  );
}
