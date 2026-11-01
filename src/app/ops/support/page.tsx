import Link from "next/link";
import { LifeBuoy, MessageSquare, UserRoundCheck } from "lucide-react";
import { getDb } from "@/db/client";
import { requireOps } from "@/lib/auth";
import { listSupportTickets } from "@/server/ops";
import { PageHeader, SandboxNote, Panel, Stat, EmptyState, Disclosure } from "@/components/ui/misc";
import { Badge, StatusPill } from "@/components/ui/badge";
import { SupportTicketForm } from "@/components/app/ops-forms";
import { relativeTime } from "@/lib/utils";

export const metadata = { title: "Support queue" };

export default async function OpsSupportPage() {
  await requireOps("ops:read");
  const db = getDb();
  const tickets = listSupportTickets(db);
  const open = tickets.filter((ticket) => String(ticket.status) === "open").length;
  const pending = tickets.filter((ticket) => String(ticket.status) === "pending").length;
  const resolved = tickets.filter((ticket) => String(ticket.status) === "resolved").length;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Operations · support"
        title="Support queue"
        description="Triage synthetic customer requests. Status and priority changes are recorded in the audit trail."
      />
      <SandboxNote />

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label="Open" value={open} hint="Awaiting first response" icon={<LifeBuoy className="h-4 w-4" />} />
        <Stat label="Pending" value={pending} hint="Waiting on the customer" icon={<MessageSquare className="h-4 w-4" />} />
        <Stat label="Resolved" value={resolved} hint="Closed in this sandbox" icon={<UserRoundCheck className="h-4 w-4" />} />
      </section>

      <Panel title="Tickets" description={`${tickets.length} total`}>
        {tickets.length === 0 ? (
          <EmptyState title="No tickets" description="The support queue is clear." icon={<LifeBuoy className="h-5 w-5" />} />
        ) : (
          <div className="space-y-3">
            {tickets.map((ticket) => (
              <div key={String(ticket.id)} className="rounded-[11px] border border-border bg-surface p-3.5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[12.5px] font-semibold">{String(ticket.subject)}</p>
                      <StatusPill status={String(ticket.status)} />
                      <Badge variant={String(ticket.priority) === "high" ? "danger" : String(ticket.priority) === "low" ? "neutral" : "warning"}>
                        {String(ticket.priority)}
                      </Badge>
                    </div>
                    <p className="mt-1 text-[10.5px] text-subtle">
                      {String(ticket.user_name ?? "Unknown customer")} · opened {relativeTime(String(ticket.created_at))} · updated {relativeTime(String(ticket.updated_at))}
                    </p>
                    <p className="mt-0.5 text-[10px] text-subtle">
                      Assignee: {String(ticket.assignee_name ?? "Unassigned")} · <span className="mono">{String(ticket.id)}</span>
                    </p>
                  </div>
                  {ticket.user_id ? (
                    <Link href={`/ops/customers/${String(ticket.user_id)}`} className="text-[10.5px] font-semibold text-primary hover:underline">
                      Open customer
                    </Link>
                  ) : null}
                </div>
                <div className="mt-3 border-t border-border/70 pt-3">
                  <SupportTicketForm ticketId={String(ticket.id)} status={String(ticket.status)} priority={String(ticket.priority)} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Disclosure>Support records are synthetic. Updating a ticket never moves money or changes a customer balance.</Disclosure>
    </div>
  );
}
