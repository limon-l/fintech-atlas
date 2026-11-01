import Link from "next/link";
import { ArrowRight, ArrowUpRight, Globe2, Plus, Send, ShieldCheck, Timer } from "lucide-react";
import { getDb } from "@/db/client";
import { requireUser } from "@/lib/auth";
import { listTransfers } from "@/server/transfers";
import { PageHeader, Panel, SandboxNote, EmptyState, Disclosure, Stat } from "@/components/ui/misc";
import { Money } from "@/components/ui/money";
import { Badge, StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, relativeTime } from "@/lib/utils";

export const metadata = { title: "Transfers" };

export default async function TransfersPage() {
  const user = await requireUser("/app/transfers");
  const db = getDb();
  const transfers = listTransfers(db, user.id, 50);
  const processing = transfers.filter((transfer) => transfer.status === "processing");
  const completed = transfers.filter((transfer) => transfer.status === "posted");
  const totalOut = completed.reduce((acc, transfer) => acc + transfer.sourceAmountMinor, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Personal · money movement"
        title="Transfers"
        description="Every payout carries a state machine, an idempotency key and a ledger trace. Nothing moves twice by accident."
        actions={
          <>
            <Button asChild variant="secondary" size="sm"><Link href="/app/fx"><Globe2 className="h-3.5 w-3.5" /> Convert</Link></Button>
            <Button asChild size="sm"><Link href="/app/transfers/new"><Plus className="h-3.5 w-3.5" /> New transfer</Link></Button>
          </>
        }
      />
      <SandboxNote />

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label="Transfers" value={transfers.length} hint="Across all states" icon={<Send className="h-4 w-4" />} />
        <Stat label="In flight" value={processing.length} hint="Funds held until settlement" icon={<Timer className="h-4 w-4" />} trend={processing.length > 0 ? <Badge variant="info">Processing</Badge> : undefined} />
        <Stat label="Posted volume" value={<Money amountMinor={totalOut} currency={transfers[0]?.sourceCurrency ?? "USD"} />} hint="Source-currency total" icon={<ShieldCheck className="h-4 w-4" />} />
      </section>

      {processing.length > 0 ? (
        <Panel title="In flight" description="These payments have active holds and are waiting for provider settlement.">
          <div className="space-y-2.5">
            {processing.map((transfer) => (
              <Link key={transfer.id} href={`/app/transfers/${transfer.id}`} className="flex items-center gap-3 rounded-[10px] border border-info/20 bg-info-soft/40 px-3 py-3 transition-colors hover:bg-info-soft">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-info-soft text-info"><Timer className="h-3.5 w-3.5" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11.5px] font-semibold">{transfer.beneficiaryName ?? transfer.destinationName ?? "External payout"}</p>
                  <p className="mono text-[9px] text-muted">{transfer.reference} · {relativeTime(transfer.createdAt)}</p>
                </div>
                <div className="text-right">
                  <Money amountMinor={transfer.sourceAmountMinor} currency={transfer.sourceCurrency} className="text-[11.5px] font-semibold" />
                  <p className="text-[9px] text-muted">held</p>
                </div>
                <ArrowUpRight className="h-3.5 w-3.5 text-subtle" />
              </Link>
            ))}
          </div>
        </Panel>
      ) : null}

      <Panel title="All transfers" description="Newest first" bodyClassName="p-0">
        {transfers.length === 0 ? (
          <EmptyState
            title="No transfers yet"
            description="Send money between your wallets, to a saved beneficiary, or convert to another currency."
            action={<Button asChild size="sm"><Link href="/app/transfers/new">Start a transfer</Link></Button>}
            className="m-4"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border text-[9px] uppercase tracking-[0.1em] text-subtle">
                  <th className="px-5 py-2.5 font-semibold">Reference</th>
                  <th className="px-3 py-2.5 font-semibold">Destination</th>
                  <th className="px-3 py-2.5 font-semibold">Route</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Amount</th>
                  <th className="px-3 py-2.5 font-semibold">Status</th>
                  <th className="px-5 py-2.5 text-right font-semibold">Created</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((transfer) => (
                  <tr key={transfer.id} className="border-b border-border/50 last:border-0 hover:bg-surface-2/50">
                    <td className="px-5 py-3">
                      <Link href={`/app/transfers/${transfer.id}`} className="mono text-[10.5px] font-semibold text-primary hover:underline">{transfer.reference}</Link>
                    </td>
                    <td className="max-w-[220px] truncate px-3 py-3 text-[11px]">{transfer.beneficiaryName ?? transfer.destinationName ?? "External beneficiary"}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5 text-[10px] text-muted">
                        <span className="mono">{transfer.sourceCurrency}</span>
                        <ArrowRight className="h-2.5 w-2.5" />
                        <span className="mono">{transfer.targetCurrency ?? transfer.sourceCurrency}</span>
                        <Badge variant="neutral" className="!px-1.5 !py-0.5 !text-[8px]">{transfer.direction}</Badge>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Money amountMinor={transfer.sourceAmountMinor} currency={transfer.sourceCurrency} className="text-[11px] font-semibold" />
                      {transfer.feeMinor > 0 ? <p className="text-[8.5px] text-subtle">+ <Money amountMinor={transfer.feeMinor} currency={transfer.sourceCurrency} compact /> fee</p> : null}
                    </td>
                    <td className="px-3 py-3"><StatusPill status={transfer.status} className="!px-1.5 !py-0.5 !text-[8.5px]" /></td>
                    <td className="px-5 py-3 text-right text-[10px] text-subtle">{formatDate(transfer.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="grid gap-4 sm:grid-cols-2">
        <Panel title="How a transfer becomes final" description="The same state machine for every route">
          <ol className="space-y-2.5">
            {[
              ["Authorize", "PIN verification and server-side balance check."],
              ["Hold", "External payouts reserve available funds without changing the ledger balance."],
              ["Post", "Settlement writes a balanced journal and captures the hold."],
              ["Reverse", "Corrections create a compensating journal; nothing is edited in place."],
            ].map(([title, body], index) => (
              <li key={title} className="flex gap-2.5">
                <span className="mono flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[9px] font-semibold text-muted">{index + 1}</span>
                <div><p className="text-[11px] font-semibold">{title}</p><p className="text-[10px] text-muted">{body}</p></div>
              </li>
            ))}
          </ol>
        </Panel>
        <Panel title="Idempotency" description="Why a retry cannot double-pay">
          <p className="text-[11.5px] leading-relaxed text-muted">
            Every submission carries a client key and a request hash. The key is claimed inside the same
            database transaction that posts money. A replay returns the original result instead of creating
            a second transfer.
          </p>
          <div className="mt-3 rounded-[9px] bg-surface-2/70 px-3 py-2.5">
            <p className="mono text-[9px] uppercase tracking-[0.1em] text-subtle">Guarantee</p>
            <p className="mt-1 text-[11px] font-semibold">At most one journal per key, even under retry.</p>
          </div>
        </Panel>
      </div>

      <Disclosure>Transfer receipts are sandbox artefacts. Provider settlement is simulated and no external payment network is contacted.</Disclosure>
    </div>
  );
}
