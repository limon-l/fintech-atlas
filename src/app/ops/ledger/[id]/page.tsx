import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRightLeft, RotateCcw, ShieldCheck } from "lucide-react";
import { getDb } from "@/db/client";
import { requireOps } from "@/lib/auth";
import { getJournalDetail } from "@/server/ops";
import { PageHeader, SandboxNote, Panel, KeyValue, Disclosure, InlineAlert } from "@/components/ui/misc";
import { Badge, StatusPill } from "@/components/ui/badge";
import { Money } from "@/components/ui/money";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ReverseJournalForm } from "@/components/app/ops-forms";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Journal entry" };

export default async function OpsJournalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireOps("ops:ledger");
  const db = getDb();
  const detail = getJournalDetail(db, id);
  if (!detail) notFound();
  const { journal, postings, reversal } = detail;

  const totals = new Map<string, number>();
  for (const posting of postings) {
    totals.set(posting.currency, (totals.get(posting.currency) ?? 0) + posting.amount_minor);
  }
  const balanced = [...totals.values()].every((total) => total === 0);
  const canReverse = journal.status === "posted" && !reversal;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Operations · ledger"
        title={journal.reference}
        description={journal.description}
        actions={
          <>
            <Button asChild variant="secondary" size="sm">
              <Link href="/ops/ledger"><ArrowLeft className="h-3.5 w-3.5" /> Ledger</Link>
            </Button>
            <StatusPill status={journal.status} />
          </>
        }
      />
      <SandboxNote />

      {!balanced ? (
        <InlineAlert tone="danger" title="Unbalanced journal">
          The postings in this journal do not net to zero for at least one currency. This should be impossible while the database guards are enabled.
        </InlineAlert>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-4">
          <Panel title="Postings" description="Signed amounts: debit positive, credit negative" bodyClassName="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ledger account</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Side</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {postings.map((posting) => (
                  <TableRow key={posting.id}>
                    <TableCell>
                      <p className="text-[11.5px] font-semibold">{posting.name}</p>
                      <p className="mono mt-0.5 text-[9.5px] text-subtle">{posting.code}</p>
                    </TableCell>
                    <TableCell><Badge variant="outline">{posting.type}</Badge></TableCell>
                    <TableCell className="text-[10.5px] text-muted">{posting.account_name ?? "System"}</TableCell>
                    <TableCell>
                      <Badge variant={posting.amount_minor > 0 ? "info" : "violet"}>
                        {posting.amount_minor > 0 ? "Debit" : "Credit"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Money amountMinor={posting.amount_minor} currency={posting.currency} signed className="text-[11.5px] font-semibold" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex flex-wrap gap-2 border-t border-border px-5 py-3">
              {[...totals.entries()].map(([currency, total]) => (
                <Badge key={currency} variant={total === 0 ? "success" : "danger"}>
                  {currency} nets {total === 0 ? "zero" : total.toLocaleString()}
                </Badge>
              ))}
            </div>
          </Panel>

          <Panel title="Journal metadata" description="Immutable record">
            <dl className="divide-y divide-border/70">
              <KeyValue label="Journal ID" value={<span className="mono text-[10.5px]">{journal.id}</span>} />
              <KeyValue label="Kind" value={<Badge variant="outline">{journal.kind}</Badge>} />
              <KeyValue label="Status" value={<StatusPill status={journal.status} />} />
              <KeyValue label="Actor" value={journal.actor_id ? <span className="mono text-[10.5px]">{journal.actor_id}</span> : "System"} />
              <KeyValue label="Transfer" value={journal.transfer_id ? <span className="mono text-[10.5px]">{journal.transfer_reference ?? journal.transfer_id}</span> : "—"} />
              <KeyValue label="Created" value={formatDateTime(journal.created_at)} />
              <KeyValue label="Posted" value={journal.posted_at ? formatDateTime(journal.posted_at) : "—"} />
              <KeyValue label="Reversal of" value={journal.reversal_of ? <span className="mono text-[10.5px]">{journal.reversal_of}</span> : "—"} />
            </dl>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Correction" description="Reversals are new, balanced journals">
            {reversal ? (
              <div className="rounded-[10px] border border-violet/25 bg-violet-soft px-3 py-3">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold text-violet">
                  <ArrowRightLeft className="h-3.5 w-3.5" /> Already reversed
                </p>
                <p className="mt-1 text-[10.5px] text-muted">
                  A compensating journal exists: <Link href={`/ops/ledger/${reversal.id}`} className="mono font-semibold text-primary hover:underline">{reversal.reference}</Link>
                </p>
              </div>
            ) : !canReverse ? (
              <p className="text-[11px] text-muted">Only posted journals can be reversed.</p>
            ) : (
              <ReverseJournalForm journalId={journal.id} />
            )}
          </Panel>

          <Panel title="Guardrails" description="Why the ledger can be trusted">
            <ul className="space-y-2.5">
              {[
                [ShieldCheck, "Zero-sum per currency", "postJournal checks every posting currency before writing."],
                [ShieldCheck, "Database trigger", "A second guard rejects unbalanced posted journals at the SQLite layer."],
                [ShieldCheck, "Append-only", "Corrections create a reversal journal with inverted postings."],
                [ShieldCheck, "Audited", "Operational reversals record the actor, reason and new journal."],
              ].map(([Icon, title, body]) => {
                const Component = Icon as typeof ShieldCheck;
                return (
                  <li key={String(title)} className="flex gap-2.5">
                    <Component className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                    <div>
                      <p className="text-[11px] font-semibold">{String(title)}</p>
                      <p className="mt-0.5 text-[10px] leading-relaxed text-muted">{String(body)}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Panel>

          {journal.status === "posted" && !reversal ? (
            <div className="flex items-center gap-2 rounded-[10px] border border-border bg-surface-2/50 px-3 py-2.5 text-[10.5px] text-muted">
              <RotateCcw className="h-3.5 w-3.5 text-muted" /> Reversing this journal posts a new entry. The original remains intact.
            </div>
          ) : null}
        </div>
      </section>

      <Disclosure>Journal records are local sandbox data. Reversal requires the operations ledger permission and the authorization PIN.</Disclosure>
    </div>
  );
}
