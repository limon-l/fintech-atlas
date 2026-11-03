import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, Clock, ShieldCheck, X } from "lucide-react";
import { getDb } from "@/db/client";
import { requireBusiness } from "@/lib/auth";
import { getApprovalDetail } from "@/server/business";
import { PageHeader, SandboxNote, Panel, KeyValue, EmptyState, Disclosure } from "@/components/ui/misc";
import { Money } from "@/components/ui/money";
import { StatusPill, Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ApprovalDecisionForm } from "@/components/app/business-forms";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Approval" };

function value(resource: Record<string, unknown> | null, key: string): string {
  const raw = resource?.[key];
  if (raw === null || raw === undefined) return "—";
  return String(raw);
}

export default async function ApprovalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireBusiness("approval:read");
  const db = getDb();
  const detail = getApprovalDetail(db, ctx.orgId, id);
  if (!detail) notFound();
  const { request, steps, resource } = detail;
  const currentStep = steps.find((step) => step.step_no === request.current_step);
  const roleMatches =
    currentStep !== undefined &&
    (ctx.role === currentStep.role_required || (ctx.role === "owner" && currentStep.role_required === "finance_manager"));
  const isMaker = request.requested_by === ctx.user.id;
  const canDecide = request.status === "pending" && roleMatches && !isMaker;
  const reason = request.status !== "pending"
    ? "This request is already decided."
    : isMaker
      ? "Maker-checker blocks you from deciding your own request."
      : !roleMatches
        ? `This step requires the ${currentStep?.role_required.replace("_", " ") ?? "required"} role.`
        : undefined;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={`Business · ${request.type}`}
        title={request.title}
        description={`Requested by ${request.requested_by_name} · ${formatDateTime(request.created_at)}`}
        actions={
          <>
            <Button asChild variant="secondary" size="sm"><Link href="/business/approvals"><ArrowLeft className="h-3.5 w-3.5" /> Queue</Link></Button>
            <StatusPill status={request.status} />
          </>
        }
      />
      <SandboxNote />

      <section className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-4">
          <Panel title="Request" description="Core fields">
            <dl className="divide-y divide-border/70">
              <KeyValue label="Amount" value={<Money amountMinor={request.amount_minor} currency={request.currency} className="text-[15px] font-semibold" />} />
              <KeyValue label="Type" value={<Badge variant="outline">{request.type}</Badge>} />
              <KeyValue label="Current step" value={`${request.current_step} of ${request.total_steps}`} />
              <KeyValue label="Maker" value={request.requested_by_name} />
              <KeyValue label="Created" value={formatDateTime(request.created_at)} />
              <KeyValue label="Decided" value={request.decided_at ? formatDateTime(request.decided_at) : "—"} />
            </dl>
          </Panel>

          <Panel title="Approval trail" description="Each step is recorded with actor and comment">
            <ol className="space-y-3">
              {steps.map((step) => (
                <li key={step.id} className="flex gap-3">
                  <span
                    className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                      step.status === "approved"
                        ? "bg-success-soft text-success"
                        : step.status === "rejected"
                          ? "bg-danger-soft text-danger"
                          : step.step_no === request.current_step
                            ? "bg-warning-soft text-warning"
                            : "bg-surface-2 text-subtle"
                    }`}
                  >
                    {step.status === "approved" ? <Check className="h-3.5 w-3.5" /> : step.status === "rejected" ? <X className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[11.5px] font-semibold">Step {step.step_no} · {step.role_required.replace("_", " ")}</p>
                      <StatusPill status={step.status} />
                    </div>
                    <p className="mt-0.5 text-[10px] text-subtle">
                      {step.decided_by_name ? `${step.decided_by_name} · ${step.decided_at ? formatDateTime(step.decided_at) : ""}` : "Awaiting decision"}
                    </p>
                    {step.comment ? <p className="mt-1 rounded-[7px] bg-surface-2 px-2.5 py-1.5 text-[10.5px] text-muted">{step.comment}</p> : null}
                  </div>
                </li>
              ))}
            </ol>
          </Panel>

          {resource ? (
            <Panel title="Underlying record" description={`${request.type} details`}>
              <dl className="divide-y divide-border/70">
                {Object.entries(resource)
                  .filter(([key]) => !["id", "org_id", "created_at", "submitted_at"].includes(key))
                  .slice(0, 12)
                  .map(([key, raw]) => (
                    <KeyValue
                      key={key}
                      label={key.replace(/_/g, " ")}
                      value={
                        typeof raw === "number" && (key.includes("amount") || key.includes("minor"))
                          ? <Money amountMinor={raw} currency={request.currency} />
                          : <span className={key === "id" ? "mono text-[10px]" : undefined}>{value(resource, key)}</span>
                      }
                    />
                  ))}
              </dl>
            </Panel>
          ) : (
            <EmptyState title="No linked record" description="This approval type does not expose a resource payload." />
          )}
        </div>

        <div className="space-y-4">
          <Panel title="Decision" description="Step-up PIN required">
            {request.status === "pending" && reason ? (
              <div className="mb-3 rounded-[9px] border border-warning/25 bg-warning-soft px-3 py-2 text-[10.5px] leading-relaxed text-warning">
                {reason}
              </div>
            ) : null}
            <ApprovalDecisionForm
              approvalId={request.id}
              disabled={!canDecide}
              decided={request.status !== "pending"}
              status={request.status}
            />
          </Panel>

          <Panel title="Guardrails" description="Why this cannot be bypassed">
            <ul className="space-y-2.5">
              {[
                ["Server-enforced role", "decideApproval checks the current step role in the database on every call."],
                ["Maker-checker", "The requester is rejected even if their role matches the step."],
                ["PIN verification", "The action verifies the hashed PIN with rate limiting before writing."],
                ["Audit + webhook", "Every decision writes an audit event and a webhook queue record."],
              ].map(([title, body]) => (
                <li key={title} className="flex gap-2">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                  <div>
                    <p className="text-[11px] font-semibold">{title}</p>
                    <p className="mt-0.5 text-[10px] leading-relaxed text-muted">{body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </section>

      <Disclosure>Approvals are a sandbox demonstration of segregation of duties. They do not move real funds.</Disclosure>
    </div>
  );
}
