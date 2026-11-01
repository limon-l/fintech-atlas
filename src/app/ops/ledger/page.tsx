import Link from "next/link";
import { BookOpenCheck, Search, ShieldCheck, Sigma } from "lucide-react";
import { getDb } from "@/db/client";
import { requireOps } from "@/lib/auth";
import { listJournals } from "@/server/ops";
import { PageHeader, SandboxNote, Panel, Stat, EmptyState, Disclosure } from "@/components/ui/misc";
import { Badge, StatusPill } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdjustmentForm } from "@/components/app/ops-forms";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Ledger inspector" };

const KINDS = ["transfer", "fx", "fee", "invoice", "reversal", "card", "goal", "adjustment", "deposit"];

export default async function OpsLedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; kind?: string }>;
}) {
  await requireOps("ops:ledger");
  const { q = "", kind = "" } = await searchParams;
  const db = getDb();
  const journals = listJournals(db, { search: q, kind: kind || undefined, limit: 100 });
  const all = listJournals(db, { limit: 100 });
  const accounts = db
    .prepare("SELECT id, name, currency FROM accounts WHERE status = 'active' ORDER BY name ASC")
    .all() as Array<{ id: string; name: string; currency: string }>;
  const unbalanced = all.filter((journal) => journal.unbalancedCurrencies > 0).length;
  const reversals = all.filter((journal) => journal.kind === "reversal").length;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Operations · proof"
        title="Ledger inspector"
        description="Immutable journal entries with signed postings. Every currency must net to zero. Reversals create new journals; posted records are never edited."
      />
      <SandboxNote />

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label="Journals shown" value={journals.length} hint={`${all.length} recent journals inspected`} icon={<BookOpenCheck className="h-4 w-4" />} />
        <Stat label="Unbalanced" value={unbalanced} hint="Must remain zero" icon={<Sigma className="h-4 w-4" />} trend={unbalanced === 0 ? <Badge variant="success">Balanced</Badge> : <Badge variant="danger">Investigate</Badge>} />
        <Stat label="Reversals" value={reversals} hint="Compensating journals" icon={<ShieldCheck className="h-4 w-4" />} />
      </section>

      <form className="grid gap-2 sm:grid-cols-[1fr_auto_auto]" action="/ops/ledger">
        <div>
          <label className="sr-only" htmlFor="ledger-search">Search journals</label>
          <Input id="ledger-search" name="q" defaultValue={q} placeholder="Search reference or description…" />
        </div>
        <div>
          <label className="sr-only" htmlFor="ledger-kind">Journal kind</label>
          <Select id="ledger-kind" name="kind" defaultValue={kind}>
            <option value="">All kinds</option>
            {KINDS.map((option) => <option key={option} value={option}>{option}</option>)}
          </Select>
        </div>
        <SubmitButton variant="secondary">
          <Search className="h-3.5 w-3.5" /> Filter
        </SubmitButton>
      </form>

      <Panel title="Journal entries" description={`${journals.length} matching records`} bodyClassName="p-0">
        {journals.length === 0 ? (
          <EmptyState title="No journals" description="No entries match this filter." className="m-5" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Postings</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {journals.map((journal) => (
                <TableRow key={journal.id}>
                  <TableCell>
                    <Link href={`/ops/ledger/${journal.id}`} className="mono text-[10.5px] font-semibold text-primary hover:underline">
                      {journal.reference}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-[280px] truncate text-[11.5px]">{journal.description}</TableCell>
                  <TableCell><Badge variant="outline">{journal.kind}</Badge></TableCell>
                  <TableCell className="text-[11px]">{journal.postingCount}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <StatusPill status={journal.status} />
                      {journal.unbalancedCurrencies > 0 ? <Badge variant="danger">Unbalanced</Badge> : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-[10.5px] text-subtle">{formatDateTime(journal.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>

      <Panel title="Controlled adjustment" description="Posts a new journal; never edits history">
        <div className="max-w-xl">
          <AdjustmentForm accounts={accounts} />
        </div>
      </Panel>

      <Disclosure>Journal entries are append-only. A database trigger rejects any posted journal whose postings do not net to zero per currency.</Disclosure>
    </div>
  );
}
