import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BookOpenCheck,
  CreditCard,
  Download,
  ShieldCheck,
  Tag,
} from "lucide-react";
import { getDb } from "@/db/client";
import { requireUser } from "@/lib/auth";
import { getTransaction } from "@/server/finance";
import { getJournalDetail } from "@/server/ops";
import { PageHeader, Panel, SandboxNote, Disclosure, KeyValue, EmptyState } from "@/components/ui/misc";
import { Money } from "@/components/ui/money";
import { Badge, StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CategoryPill } from "@/components/app/finance-bits";
import { BalanceCheck, PostingsTable, type PostingView } from "@/components/app/ledger-bits";
import { cn, formatDateTime } from "@/lib/utils";

export const metadata = { title: "Transaction" };

export default async function TransactionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/app/transactions/${id}`);
  const db = getDb();
  const transaction = getTransaction(db, "user", user.id, id);
  if (!transaction) notFound();
  const journal = transaction.journalId ? getJournalDetail(db, transaction.journalId) : null;
  const postings: PostingView[] =
    journal?.postings.map((posting) => ({
      id: posting.id,
      ledgerCode: posting.code,
      ledgerName: posting.account_name ?? posting.name,
      type: posting.type,
      currency: posting.currency,
      amountMinor: Math.abs(posting.amount_minor),
      side: posting.amount_minor > 0 ? "debit" : "credit",
      isCustomer: Boolean(posting.account_id),
    })) ?? [];
  const credit = transaction.direction === "credit";

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Transaction receipt"
        title={transaction.merchant ?? transaction.description}
        description={`${formatDateTime(transaction.occurredAt)} · ${transaction.accountName}`}
        actions={
          <>
            <Button asChild variant="secondary" size="sm"><Link href="/app/transactions">All activity</Link></Button>
            {transaction.transferId ? (
              <Button asChild size="sm"><Link href={`/app/transfers/${transaction.transferId}`}>Money flow <ArrowUpRight className="h-3.5 w-3.5" /></Link></Button>
            ) : null}
          </>
        }
      />
      <SandboxNote />

      <section className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        <div className="surface-card overflow-hidden">
          <div className="border-b border-border/70 px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className={cn("flex h-11 w-11 items-center justify-center rounded-full", credit ? "bg-success-soft text-success" : "bg-surface-2 text-muted")}>
                  {credit ? <ArrowDownLeft className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
                </span>
                <div>
                  <p className="text-[12px] text-muted">{credit ? "Received into" : "Paid from"}</p>
                  <p className="text-[13px] font-semibold">{transaction.accountName}</p>
                </div>
              </div>
              <StatusPill status={transaction.status} />
            </div>
          </div>
          <div className="px-5 py-6 text-center">
            <Money
              amountMinor={credit ? transaction.amountMinor : -transaction.amountMinor}
              currency={transaction.currency}
              signed
              className={cn("text-[38px] font-semibold tracking-[-0.04em]", credit && "text-success")}
            />
            <p className="mt-1 text-[11px] text-muted">
              {credit ? "Credit to your wallet" : "Debit from your wallet"} · {transaction.currency}
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <CategoryPill category={transaction.category} />
              {transaction.cardLast4 ? (
                <Badge variant="violet"><CreditCard className="h-3 w-3" /> •••• {transaction.cardLast4}</Badge>
              ) : null}
              {transaction.status === "processing" ? <Badge variant="info">Funds held</Badge> : null}
            </div>
          </div>
          <dl className="border-t border-border/70 px-5 py-3">
            <KeyValue label="Description" value={transaction.description} />
            <KeyValue label="Counterparty" value={transaction.counterparty ?? "—"} />
            <KeyValue label="Occurred" value={formatDateTime(transaction.occurredAt)} />
            <KeyValue label="Account" value={<Link href={`/app/accounts/${transaction.accountId}`} className="text-primary hover:underline">{transaction.accountName}</Link>} />
            <KeyValue label="Transaction ID" value={<span className="mono text-[10px]">{transaction.id}</span>} mono />
            <KeyValue label="Journal" value={journal ? <span className="mono text-[10px]">{journal.journal.reference}</span> : "No journal (processing)"} />
          </dl>
        </div>

        <div className="space-y-4">
          <Panel title="Money flow" description="Who moved value, and in which direction.">
            <div className="space-y-3">
              <div className="rounded-[10px] border border-border bg-surface-2/50 p-3">
                <p className="text-[9px] uppercase tracking-[0.1em] text-subtle">Source</p>
                <p className="mt-1 text-[12px] font-semibold">{credit ? (transaction.counterparty ?? "External payer") : transaction.accountName}</p>
                <p className="text-[10px] text-muted">{credit ? "Incoming payment" : `${transaction.currency} wallet`}</p>
              </div>
              <div className="flex justify-center text-subtle"><ArrowDownLeft className="h-4 w-4 rotate-[-90deg]" /></div>
              <div className="rounded-[10px] border border-border bg-surface-2/50 p-3">
                <p className="text-[9px] uppercase tracking-[0.1em] text-subtle">Destination</p>
                <p className="mt-1 text-[12px] font-semibold">{credit ? transaction.accountName : (transaction.counterparty ?? "External beneficiary")}</p>
                <p className="text-[10px] text-muted">{credit ? `${transaction.currency} wallet` : "Outbound payment"}</p>
              </div>
            </div>
            {transaction.transferId ? (
              <Button asChild variant="secondary" size="sm" className="mt-4 w-full">
                <Link href={`/app/transfers/${transaction.transferId}`}>Open transfer trace</Link>
              </Button>
            ) : null}
          </Panel>

          <Panel title="Controls applied" description="Checks performed before posting">
            <ul className="space-y-2.5 text-[11px] text-muted">
              {[
                ["Server-side balance check", "Available funds verified inside the database transaction."],
                ["Step-up authorization", transaction.transferId ? "PIN verified for the originating transfer." : "Card or system authorization applied."],
                ["Ledger balance", journal ? "Journal validated to zero per currency." : "Pending until settlement posts."],
              ].map(([title, body]) => (
                <li key={title} className="flex gap-2.5">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                  <div>
                    <p className="font-semibold text-foreground">{title}</p>
                    <p className="mt-0.5 text-[10.5px] leading-relaxed">{body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </section>

      <Panel title="Double-entry proof" description="The journal behind this transaction." action={journal ? <Badge variant="success">Immutable</Badge> : <Badge variant="warning">Processing</Badge>}>
        {!journal ? (
          <EmptyState title="No journal posted yet" description="Processing payments are held until settlement creates a balanced journal." />
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-[9px] bg-surface-2/60 px-3 py-2">
              <div>
                <p className="mono text-[10.5px] font-semibold">{journal.journal.reference}</p>
                <p className="text-[10px] text-muted">{journal.journal.description}</p>
              </div>
              <Badge variant="neutral">{journal.journal.kind}</Badge>
            </div>
            <PostingsTable postings={postings} />
            <BalanceCheck postings={postings} />
          </div>
        )}
      </Panel>

      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="secondary" size="sm"><Link href={`/app/accounts/${transaction.accountId}`}><Tag className="h-3.5 w-3.5" /> Account</Link></Button>
        {journal ? <Button asChild variant="secondary" size="sm"><Link href={`/ops/ledger/${journal.journal.id}`}><BookOpenCheck className="h-3.5 w-3.5" /> Inspect journal</Link></Button> : null}
        <Button asChild variant="ghost" size="sm"><Link href="/app/settings"><Download className="h-3.5 w-3.5" /> Statements</Link></Button>
      </div>

      <Disclosure>
        This receipt describes a synthetic sandbox movement. It is not a bank statement, tax document or proof of a real payment.
      </Disclosure>
    </div>
  );
}
