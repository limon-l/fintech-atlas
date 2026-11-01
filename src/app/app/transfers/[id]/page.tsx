import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpenCheck,
  Building2,
  Globe2,
  Landmark,
  ShieldCheck,
  Timer,
  Users,
  Wallet,
} from "lucide-react";
import { getDb } from "@/db/client";
import { requireUser } from "@/lib/auth";
import { getTransferDetail } from "@/server/transfers";
import { PageHeader, Panel, SandboxNote, Disclosure, KeyValue, EmptyState, InlineAlert } from "@/components/ui/misc";
import { Money } from "@/components/ui/money";
import { Badge, StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BalanceCheck, PostingsTable, Timeline, type PostingView } from "@/components/app/ledger-bits";
import { formatDateTime } from "@/lib/utils";
import { formatRate } from "@/domain/money";

export const metadata = { title: "Transfer" };

export default async function TransferDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/app/transfers/${id}`);
  const db = getDb();
  const detail = getTransferDetail(db, id, user);
  if (!detail) notFound();
  const { transfer } = detail;
  const postings: PostingView[] =
    detail.journal?.postings.map((posting, index) => ({
      id: `${posting.ledgerCode}-${index}`,
      ledgerCode: posting.ledgerCode,
      ledgerName: posting.ledgerName,
      type: posting.type,
      currency: posting.currency,
      amountMinor: posting.amountMinor,
      side: posting.side,
      isCustomer: posting.isCustomer,
    })) ?? [];
  const isProcessing = transfer.status === "processing";

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={`Transfer · ${transfer.direction}`}
        title={transfer.reference}
        description={`Initiated ${formatDateTime(transfer.createdAt)} · ${detail.sourceAccount.name}`}
        actions={
          <>
            <Button asChild variant="secondary" size="sm"><Link href="/app/transfers">All transfers</Link></Button>
            <Button asChild size="sm"><Link href="/app/transfers/new"><ArrowUpRight className="h-3.5 w-3.5" /> Send again</Link></Button>
          </>
        }
      />
      <SandboxNote />

      {isProcessing ? (
        <InlineAlert tone="info" title="Funds are held, not yet posted">
          The source wallet has an active hold covering the amount and fee. The ledger balance changes only when
          settlement posts a balanced journal.
        </InlineAlert>
      ) : null}
      {transfer.status === "failed" ? (
        <InlineAlert tone="danger" title="Transfer failed">
          {transfer.failureReason ?? "The payment could not be completed."} Any hold was released back to available balance.
        </InlineAlert>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        <div className="surface-card overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-border/70 px-5 py-4">
            <div className="flex items-center gap-2">
              <StatusPill status={transfer.status} />
              <Badge variant="outline">{transfer.direction}</Badge>
            </div>
            <span className="mono text-[9px] uppercase tracking-[0.12em] text-subtle">Ledger trace</span>
          </div>
          <div className="px-5 py-6 text-center">
            <Money amountMinor={transfer.sourceAmountMinor} currency={transfer.sourceCurrency} className="text-[38px] font-semibold tracking-[-0.04em]" />
            <p className="mt-1 text-[11px] text-muted">
              {transfer.feeMinor > 0 ? <>plus <Money amountMinor={transfer.feeMinor} currency={transfer.feeCurrency ?? transfer.sourceCurrency} compact /> fee · </> : null}
              {transfer.status === "posted" ? "settled" : transfer.status}
            </p>
            {transfer.targetAmountMinor && transfer.targetCurrency && transfer.targetCurrency !== transfer.sourceCurrency ? (
              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-surface-2 px-3 py-1.5">
                <Globe2 className="h-3.5 w-3.5 text-teal" />
                <span className="text-[10.5px] text-muted">Recipient gets</span>
                <Money amountMinor={transfer.targetAmountMinor} currency={transfer.targetCurrency} className="text-[11.5px] font-semibold" />
                {transfer.rate ? <span className="mono text-[8.5px] text-subtle">{formatRate(transfer.rate, transfer.sourceCurrency, transfer.targetCurrency)}</span> : null}
              </div>
            ) : null}
          </div>

          <div className="border-t border-border/70 px-5 py-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
              <div className="rounded-[10px] border border-border bg-surface-2/50 p-3">
                <p className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.1em] text-subtle"><Wallet className="h-2.5 w-2.5" /> From</p>
                <p className="mt-1 text-[11.5px] font-semibold">{detail.sourceAccount.name}</p>
                <p className="mono text-[9px] text-muted">{detail.sourceAccount.masked ?? detail.sourceAccount.currency}</p>
              </div>
              <ArrowRight className="mx-auto hidden h-3.5 w-3.5 text-subtle sm:block" />
              <div className="rounded-[10px] border border-border bg-surface-2/50 p-3">
                <p className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.1em] text-subtle">
                  {detail.destinationAccount ? <Wallet className="h-2.5 w-2.5" /> : detail.beneficiary ? <Building2 className="h-2.5 w-2.5" /> : <Landmark className="h-2.5 w-2.5" />} To
                </p>
                <p className="mt-1 text-[11.5px] font-semibold">
                  {detail.destinationAccount?.name ?? detail.beneficiary?.name ?? "External beneficiary"}
                </p>
                <p className="mono text-[9px] text-muted">
                  {detail.destinationAccount?.masked ?? detail.beneficiary?.masked ?? detail.beneficiary?.bankName ?? transfer.targetCurrency ?? transfer.sourceCurrency}
                </p>
              </div>
            </div>
          </div>

          <dl className="border-t border-border/70 px-5 py-3">
            <KeyValue label="Reference" value={<span className="mono text-[10.5px]">{transfer.reference}</span>} />
            <KeyValue label="Note" value={transfer.note ?? "—"} />
            <KeyValue label="Provider reference" value={<span className="mono text-[10px]">{transfer.providerRef ?? "Internal — no provider"}</span>} />
            <KeyValue label="Created" value={formatDateTime(transfer.createdAt)} />
            <KeyValue label="Settled" value={transfer.settledAt ? formatDateTime(transfer.settledAt) : "Not settled"} />
          </dl>
        </div>

        <div className="space-y-4">
          <Panel title="Timeline" description="State transitions, newest state last">
            <Timeline steps={detail.timeline} />
          </Panel>

          {detail.hold ? (
            <Panel title="Hold" description="Reserved from available balance">
              <div className="flex items-center justify-between gap-3 rounded-[10px] border border-warning/20 bg-warning-soft px-3 py-3">
                <div className="flex items-center gap-2.5">
                  <Timer className="h-4 w-4 text-warning" />
                  <div>
                    <p className="text-[11.5px] font-semibold"><Money amountMinor={detail.hold.amountMinor} currency={detail.hold.currency} /></p>
                    <p className="text-[9.5px] text-warning/80">Created {formatDateTime(detail.hold.createdAt)}</p>
                  </div>
                </div>
                <StatusPill status={detail.hold.status} className="!px-1.5 !py-0.5 !text-[8px]" />
              </div>
            </Panel>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Panel title="Settlement journal" description="Balanced postings created when the transfer settles.">
          {!detail.journal ? (
            <EmptyState title="Awaiting settlement" description="A journal is created inside the settlement transaction. Until then only a hold exists." />
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-[9px] bg-surface-2/60 px-3 py-2">
                <div>
                  <p className="mono text-[10.5px] font-semibold">{detail.journal.reference}</p>
                  <p className="text-[10px] text-muted">{detail.journal.description}</p>
                </div>
                <Badge variant="success"><ShieldCheck className="h-3 w-3" /> Balanced</Badge>
              </div>
              <PostingsTable postings={postings} />
              <BalanceCheck postings={postings} />
            </div>
          )}
        </Panel>

        <div className="space-y-4">
          {detail.feeJournal ? (
            <Panel title="Fee journal" description="Fees are posted separately and balance to zero.">
              <div className="space-y-2">
                {detail.feeJournal.postings.map((posting, index) => (
                  <div key={`${posting.ledgerName}-${index}`} className="flex items-center justify-between gap-3 text-[10.5px]">
                    <span className="text-muted">{posting.ledgerName}</span>
                    <span className="flex items-center gap-2">
                      <Badge variant={posting.side === "debit" ? "info" : "teal"} className="!px-1.5 !py-0.5 !text-[8px]">{posting.side}</Badge>
                      <Money amountMinor={posting.amountMinor} currency={posting.currency} className="font-semibold" />
                    </span>
                  </div>
                ))}
              </div>
            </Panel>
          ) : null}

          <Panel title="Provider events" description="Simulated payment-network callbacks">
            {detail.providerEvents.length === 0 ? (
              <EmptyState title="No provider events" description="Internal transfers never leave the ledger." />
            ) : (
              <div className="space-y-2">
                {detail.providerEvents.map((event) => (
                  <div key={event.id} className="flex items-center justify-between gap-3 rounded-[8px] bg-surface-2/50 px-2.5 py-2">
                    <div>
                      <p className="mono text-[9.5px] font-semibold">{event.type}</p>
                      <p className="text-[8.5px] text-subtle">{formatDateTime(event.createdAt)}</p>
                    </div>
                    <StatusPill status={event.status} className="!px-1.5 !py-0.5 !text-[8px]" />
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Linked transactions" description="Customer-facing rows">
            {detail.transactions.length === 0 ? (
              <EmptyState title="No linked transactions" />
            ) : (
              <div className="space-y-2">
                {detail.transactions.map((transaction) => (
                  <Link key={transaction.id} href={`/app/transactions/${transaction.id}`} className="flex items-center justify-between gap-3 rounded-[8px] px-2 py-2 transition-colors hover:bg-surface-2">
                    <div>
                      <p className="text-[10.5px] font-medium">{transaction.description}</p>
                      <p className="mono text-[8.5px] text-subtle">{transaction.id}</p>
                    </div>
                    <div className="text-right">
                      <Money amountMinor={transaction.direction === "credit" ? transaction.amountMinor : -transaction.amountMinor} currency={transaction.currency} signed className="text-[10.5px] font-semibold" />
                      <p className="text-[8.5px] text-subtle">{transaction.status}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="secondary" size="sm"><Link href={`/app/accounts/${detail.sourceAccount.id}`}><Wallet className="h-3.5 w-3.5" /> Source account</Link></Button>
        {detail.journal ? <Button asChild variant="secondary" size="sm"><Link href={`/ops/ledger/${detail.journal.id}`}><BookOpenCheck className="h-3.5 w-3.5" /> Inspect journal</Link></Button> : null}
        {detail.beneficiary ? <Button asChild variant="ghost" size="sm"><Link href="/app/beneficiaries"><Users className="h-3.5 w-3.5" /> Beneficiary</Link></Button> : null}
      </div>

      <Disclosure>
        Settlement is simulated. In production, settlement must be driven by a signed provider webhook, never by a
        client request. The ledger remains the source of truth for both legs.
      </Disclosure>
    </div>
  );
}
