import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BookOpenCheck,
  Copy,
  Globe2,
  Landmark,
  Send,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { getDb } from "@/db/client";
import { requireUser } from "@/lib/auth";
import { listAccounts, listTransactions } from "@/server/finance";
import { PageHeader, Panel, SandboxNote, Disclosure, KeyValue, EmptyState, Stat } from "@/components/ui/misc";
import { Money } from "@/components/ui/money";
import { Badge, StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TransactionRow } from "@/components/app/finance-bits";
import { BalanceCheck, PostingsTable, type PostingView } from "@/components/app/ledger-bits";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Account" };

export default async function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/app/accounts/${id}`);
  const db = getDb();
  const account = listAccounts(db, "user", user.id).find((row) => row.id === id);
  if (!account) notFound();

  const meta = db
    .prepare("SELECT iban, bic, country, opened_at FROM accounts WHERE id = ?")
    .get(id) as { iban: string | null; bic: string | null; country: string; opened_at: string };
  const transactions = listTransactions(db, "user", user.id, { accountId: id, limit: 25 }).rows;
  const ledgerRows = db
    .prepare(
      `SELECT p.id, p.amount_minor, p.currency, la.code, la.name, la.type, je.id AS journal_id,
              je.reference, je.description, je.created_at, je.kind
       FROM postings p
       JOIN ledger_accounts la ON la.id = p.ledger_account_id
       JOIN journal_entries je ON je.id = p.journal_id
       WHERE la.account_id = ?
       ORDER BY je.created_at DESC LIMIT 25`,
    )
    .all(id) as Array<{
    id: string;
    amount_minor: number;
    currency: string;
    code: string;
    name: string;
    type: string;
    journal_id: string;
    reference: string;
    description: string;
    created_at: string;
    kind: string;
  }>;

  const postings: PostingView[] = ledgerRows.map((row) => ({
    id: row.id,
    ledgerCode: row.code,
    ledgerName: row.name,
    type: row.type,
    currency: row.currency,
    amountMinor: Math.abs(row.amount_minor),
    side: row.amount_minor > 0 ? "debit" : "credit",
    isCustomer: true,
  }));

  const inflow = transactions
    .filter((transaction) => transaction.direction === "credit")
    .reduce((acc, transaction) => acc + transaction.amountMinor, 0);
  const outflow = transactions
    .filter((transaction) => transaction.direction === "debit")
    .reduce((acc, transaction) => acc + transaction.amountMinor, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={`Accounts · ${account.kind}`}
        title={account.name}
        description="Balance is the negative sum of this account's liability postings. Available balance subtracts active holds."
        actions={
          <>
            <Button asChild variant="secondary" size="sm">
              <Link href="/app/accounts"><Wallet className="h-3.5 w-3.5" /> All accounts</Link>
            </Button>
            <Button asChild size="sm">
              <Link href={`/app/transfers/new?from=${account.id}`}><Send className="h-3.5 w-3.5" /> Send from here</Link>
            </Button>
          </>
        }
      />

      <SandboxNote />

      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="relative overflow-hidden rounded-[18px] border border-border bg-surface p-5 shadow-soft sm:p-6">
          <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-primary via-teal to-violet" />
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="eyebrow">Ledger balance</p>
              <p className="amount mt-2 text-[36px] font-semibold tracking-[-0.045em] sm:text-[42px]">
                <Money amountMinor={account.ledgerMinor} currency={account.currency} />
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" />
                  <Money amountMinor={account.availableMinor} currency={account.currency} /> available
                </span>
                {account.heldMinor > 0 ? (
                  <span className="inline-flex items-center gap-1.5 text-warning">
                    <span className="h-1.5 w-1.5 rounded-full bg-warning" />
                    <Money amountMinor={account.heldMinor} currency={account.currency} /> held
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge variant={account.status === "active" ? "success" : "danger"}>
                <ShieldCheck className="h-3 w-3" /> {account.status}
              </Badge>
              <Badge variant="outline">{account.currency}</Badge>
            </div>
          </div>

          <dl className="mt-5 grid gap-x-6 sm:grid-cols-2">
            <KeyValue label="Account number" value={<span className="mono">{account.masked ?? "—"}</span>} />
            <KeyValue label="IBAN" value={<span className="mono">{meta.iban ?? "Not issued"}</span>} />
            <KeyValue label="BIC" value={<span className="mono">{meta.bic ?? "ATLASGB2X"}</span>} />
            <KeyValue label="Country" value={meta.country} />
            <KeyValue label="Opened" value={formatDate(meta.opened_at)} />
            <KeyValue label="Ledger account" value={<span className="mono">led_{account.id}</span>} />
          </dl>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <Stat
            label="Money in (recent)"
            value={<Money amountMinor={inflow} currency={account.currency} />}
            icon={<ArrowDownLeft className="h-4 w-4" />}
            hint={`${transactions.filter((t) => t.direction === "credit").length} credit movements`}
          />
          <Stat
            label="Money out (recent)"
            value={<Money amountMinor={outflow} currency={account.currency} />}
            icon={<ArrowUpRight className="h-4 w-4" />}
            hint={`${transactions.filter((t) => t.direction === "debit").length} debit movements`}
          />
          <div className="surface-card flex items-center justify-between gap-3 p-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-subtle">Convert</p>
              <p className="mt-1 text-[11.5px] text-muted">Move value into another Atlas wallet.</p>
            </div>
            <Button asChild variant="secondary" size="sm"><Link href={`/app/fx?from=${account.id}`}><Globe2 className="h-3.5 w-3.5" /> FX</Link></Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.25fr_1fr]">
        <Panel
          title="Activity"
          description="Posted and processing transactions on this account."
          action={<Link href={`/app/transactions?account=${account.id}`} className="text-[10.5px] font-semibold text-primary hover:underline">Filter</Link>}
          bodyClassName="p-2"
        >
          {transactions.length === 0 ? (
            <EmptyState title="No activity yet" className="m-3" />
          ) : (
            <div className="divide-y divide-border/50">
              {transactions.map((transaction) => (
                <TransactionRow key={transaction.id} transaction={transaction} />
              ))}
            </div>
          )}
        </Panel>

        <div className="space-y-4">
          <Panel title="Ledger postings" description="Newest first, signed as debit or credit.">
            {postings.length === 0 ? (
              <EmptyState title="No postings" />
            ) : (
              <>
                <PostingsTable postings={postings.slice(0, 8)} compact />
                <div className="mt-3">
                  <BalanceCheck postings={postings.slice(0, 8)} />
                </div>
              </>
            )}
          </Panel>

          <Panel title="Account rules" description="What this balance means">
            <ul className="space-y-2.5 text-[11px] leading-relaxed text-muted">
              <li className="flex gap-2"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />A debit posting reduces the customer liability; a credit posting increases it.</li>
              <li className="flex gap-2"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-teal" />Holds do not change the ledger balance — they reduce availability only.</li>
              <li className="flex gap-2"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-violet" />Every journal on this account balances to zero in each currency.</li>
            </ul>
            <Link href="/docs/ledger" className="mt-4 inline-flex items-center gap-1.5 text-[10.5px] font-semibold text-primary hover:underline">
              <BookOpenCheck className="h-3.5 w-3.5" /> Ledger specification
            </Link>
          </Panel>
        </div>
      </section>

      <Panel title="Recent journals" description="The immutable entries behind the balance." bodyClassName="p-0">
        {ledgerRows.length === 0 ? (
          <EmptyState title="No journals yet" className="m-4" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border text-[9px] uppercase tracking-[0.1em] text-subtle">
                  <th className="px-5 py-2.5 font-semibold">Journal</th>
                  <th className="px-3 py-2.5 font-semibold">Description</th>
                  <th className="px-3 py-2.5 font-semibold">Kind</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Signed posting</th>
                  <th className="px-5 py-2.5 text-right font-semibold">Date</th>
                </tr>
              </thead>
              <tbody>
                {ledgerRows.map((row) => (
                  <tr key={row.id} className="border-b border-border/50 last:border-0 hover:bg-surface-2/50">
                    <td className="px-5 py-3">
                      <Link href={`/ops/ledger/${row.journal_id}`} className="mono text-[10.5px] font-semibold text-primary hover:underline">
                        {row.reference}
                      </Link>
                    </td>
                    <td className="max-w-[280px] truncate px-3 py-3 text-[11px]">{row.description}</td>
                    <td className="px-3 py-3"><Badge variant="neutral" className="!text-[9px]">{row.kind}</Badge></td>
                    <td className="px-3 py-3 text-right">
                      <Money amountMinor={row.amount_minor} currency={row.currency} signed className="text-[11px] font-semibold" />
                    </td>
                    <td className="px-5 py-3 text-right text-[10px] text-subtle">{formatDate(row.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Disclosure>
        Sandbox account. The IBAN, BIC and account number are synthetic and cannot receive real payments.
        Balances reconcile to the double-entry ledger, not to an external bank statement.
      </Disclosure>
    </div>
  );
}
