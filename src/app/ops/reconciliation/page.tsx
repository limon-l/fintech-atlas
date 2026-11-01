import { AlertTriangle, ArrowRight, CheckCircle2, Landmark, ListChecks } from "lucide-react";
import { getDb } from "@/db/client";
import { requireOps } from "@/lib/auth";
import { getLatestReconciliation } from "@/server/ops";
import { PageHeader, SandboxNote, Panel, Stat, EmptyState, Disclosure } from "@/components/ui/misc";
import { Badge, StatusPill } from "@/components/ui/badge";
import { Money } from "@/components/ui/money";
import { ReconcileButton, ReconciliationItemForm } from "@/components/app/ops-forms";
import { formatDateTime, relativeTime } from "@/lib/utils";

export const metadata = { title: "Reconciliation" };

export default async function OpsReconciliationPage() {
  await requireOps("ops:reconcile");
  const db = getDb();
  const { run, items, history } = getLatestReconciliation(db);
  const exceptions = items.filter((item) => ["exception", "investigating"].includes(item.status));
  const matched = items.filter((item) => item.status === "matched" || item.status === "resolved").length;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Operations · proof"
        title="Reconciliation"
        description="Compare posted external payouts with synthetic provider settlements. Amounts are integer minor units; differences are never silently written off."
        actions={<ReconcileButton />}
      />
      <SandboxNote />

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Latest run"
          value={run ? (run.status === "completed" ? "Completed" : run.status) : "No run"}
          hint={run ? `${formatDateTime(run.startedAt)} · ${run.actorName ?? "system"}` : "Run a reconciliation to begin"}
          icon={<Landmark className="h-4 w-4" />}
        />
        <Stat
          label="Exceptions"
          value={exceptions.length}
          hint={exceptions.length === 0 ? "All items matched" : "Require investigation"}
          icon={<AlertTriangle className="h-4 w-4" />}
          trend={exceptions.length > 0 ? <Badge variant="warning">Review</Badge> : <Badge variant="success">Balanced</Badge>}
        />
        <Stat label="Matched items" value={matched} hint={`${items.length} items in this run`} icon={<CheckCircle2 className="h-4 w-4" />} />
      </section>

      {!run ? (
        <EmptyState title="No reconciliation run" description="Run the sandbox reconciliation to compare payout journals with provider events." icon={<ListChecks className="h-5 w-5" />} />
      ) : (
        <section className="grid gap-4 xl:grid-cols-[1.4fr_0.6fr]">
          <Panel title="Run items" description={`${run.id} · completed ${run.completedAt ? relativeTime(run.completedAt) : "in progress"}`}>
            {items.length === 0 ? (
              <EmptyState title="No items" description="This run produced no reconciliation items." />
            ) : (
              <div className="space-y-2.5">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className={`rounded-[11px] border px-3.5 py-3 ${
                      item.status === "exception"
                        ? "border-danger/25 bg-danger-soft/30"
                        : item.status === "investigating"
                          ? "border-warning/25 bg-warning-soft/30"
                          : "border-border bg-surface"
                    }`}
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{item.currency}</Badge>
                          <StatusPill status={item.status} />
                          {item.transferReference ? (
                            <span className="mono text-[9.5px] text-subtle">{item.transferReference}</span>
                          ) : null}
                        </div>
                        <p className="mt-1.5 text-[11px] text-muted">{item.note}</p>
                      </div>
                      <dl className="grid grid-cols-3 gap-3 text-[10px] sm:text-right">
                        <div><dt className="text-subtle">Ledger</dt><dd className="mt-0.5 font-semibold"><Money amountMinor={item.ledgerMinor} currency={item.currency} /></dd></div>
                        <div><dt className="text-subtle">Provider</dt><dd className="mt-0.5 font-semibold"><Money amountMinor={item.providerMinor} currency={item.currency} /></dd></div>
                        <div><dt className="text-subtle">Difference</dt><dd className={`mt-0.5 font-semibold ${item.differenceMinor === 0 ? "text-success" : "text-danger"}`}><Money amountMinor={item.differenceMinor} currency={item.currency} signed /></dd></div>
                      </dl>
                    </div>
                    {["exception", "investigating"].includes(item.status) ? (
                      <details className="mt-3 border-t border-border/70 pt-3">
                        <summary className="cursor-pointer text-[11px] font-semibold text-primary">Record a resolution</summary>
                        <div className="mt-3">
                          <ReconciliationItemForm itemId={item.id} />
                        </div>
                      </details>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <div className="space-y-4">
            <Panel title="Run history" description="Most recent six runs">
              {history.length === 0 ? (
                <EmptyState title="No history" />
              ) : (
                <ol className="space-y-2">
                  {history.map((entry) => (
                    <li key={entry.id} className="rounded-[9px] border border-border bg-surface px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="mono text-[9.5px] text-subtle">{entry.id}</span>
                        <Badge variant={entry.exceptionCount > 0 ? "warning" : "success"}>{entry.exceptionCount} exc</Badge>
                      </div>
                      <p className="mt-1 text-[10px] text-muted">{formatDateTime(entry.startedAt)} · {entry.itemCount} items</p>
                    </li>
                  ))}
                </ol>
              )}
            </Panel>

            <Panel title="How this works" description="Deterministic, not a live feed">
              <ul className="space-y-2.5 text-[10.5px] leading-relaxed text-muted">
                <li className="flex gap-2"><ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-primary" /> Posted external payouts are grouped by currency.</li>
                <li className="flex gap-2"><ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-primary" /> Settled provider events are summed from the local queue.</li>
                <li className="flex gap-2"><ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-primary" /> Any difference becomes an exception, never an automatic adjustment.</li>
                <li className="flex gap-2"><ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-primary" /> Resolving an item records a note, an actor and an audit event.</li>
              </ul>
            </Panel>
          </div>
        </section>
      )}

      <Disclosure>Provider settlements are synthetic. Reconciliation demonstrates the control loop; it is not connected to a payment network.</Disclosure>
    </div>
  );
}
