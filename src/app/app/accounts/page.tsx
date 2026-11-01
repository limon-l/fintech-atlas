import Link from "next/link";
import { ArrowRight, ArrowUpRight, BookOpenCheck, CreditCard, Globe2, Landmark, ShieldCheck, Wallet } from "lucide-react";
import { getDb } from "@/db/client";
import { requireUser } from "@/lib/auth";
import { getCards, getPortfolio } from "@/server/finance";
import { PageHeader, SandboxNote, Panel, Disclosure, EmptyState } from "@/components/ui/misc";
import { Money } from "@/components/ui/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AccountTile } from "@/components/app/finance-bits";

export const metadata = { title: "Accounts" };

export default async function AccountsPage() {
  const user = await requireUser("/app/accounts");
  const db = getDb();
  const portfolio = getPortfolio(db, "user", user.id);
  const cards = getCards(db, "user", user.id);

  const totalHeld = portfolio.accounts.reduce((acc, account) => acc + account.heldMinor, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Personal · balances"
        title="Accounts"
        description="Every balance below is derived from signed ledger postings. Available balance subtracts active holds."
        actions={
          <>
            <Button asChild variant="secondary" size="sm"><Link href="/app/fx"><Globe2 className="h-3.5 w-3.5" /> Convert</Link></Button>
            <Button asChild size="sm"><Link href="/app/transfers/new">Send money</Link></Button>
          </>
        }
      />

      <SandboxNote />

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="relative overflow-hidden rounded-[18px] border border-border bg-surface p-5 shadow-soft sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="eyebrow">Indicative portfolio value</p>
              <p className="amount mt-2 text-[34px] font-semibold tracking-[-0.04em]">
                <Money amountMinor={portfolio.totalUsdMinor} currency="USD" />
              </p>
              <p className="mt-1 text-[11px] text-muted">
                {portfolio.accounts.length} accounts across{" "}
                {new Set(portfolio.accounts.map((account) => account.currency)).size} currencies
              </p>
            </div>
            <Badge variant="teal"><ShieldCheck className="h-3 w-3" /> Ledger verified</Badge>
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            <div className="rounded-[10px] bg-surface-2 px-3 py-2.5">
              <p className="text-[9px] uppercase tracking-[0.1em] text-subtle">Available</p>
              <Money amountMinor={portfolio.accounts.reduce((acc, a) => acc + a.availableMinor, 0)} currency="USD" className="mt-1 block text-[13px] font-semibold" />
              <p className="mt-0.5 text-[8.5px] text-subtle">sum of local available</p>
            </div>
            <div className="rounded-[10px] bg-surface-2 px-3 py-2.5">
              <p className="text-[9px] uppercase tracking-[0.1em] text-subtle">Held</p>
              <Money amountMinor={totalHeld} currency="USD" className="mt-1 block text-[13px] font-semibold text-warning" />
              <p className="mt-0.5 text-[8.5px] text-subtle">reserved for payouts</p>
            </div>
            <div className="rounded-[10px] bg-surface-2 px-3 py-2.5">
              <p className="text-[9px] uppercase tracking-[0.1em] text-subtle">Rate basis</p>
              <p className="mt-1 text-[12px] font-semibold">Synthetic</p>
              <p className="mt-0.5 text-[8.5px] text-subtle">as of {new Date(portfolio.rateAsOf).toLocaleDateString("en-GB")}</p>
            </div>
          </div>
        </div>

        <Panel title="Account map" description="Where your synthetic money lives">
          <div className="space-y-2.5">
            {portfolio.accounts.map((account) => (
              <Link key={account.id} href={`/app/accounts/${account.id}`} className="flex items-center gap-2.5 rounded-[8px] px-1.5 py-1.5 transition-colors hover:bg-surface-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-2 text-muted">
                  {account.kind === "savings" ? <Landmark className="h-3.5 w-3.5" /> : account.kind === "goal" ? <Wallet className="h-3.5 w-3.5" /> : <Wallet className="h-3.5 w-3.5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-medium">{account.name}</p>
                  <p className="text-[9px] text-subtle">{account.currency} · {account.kind}</p>
                </div>
                <Money amountMinor={account.ledgerMinor} currency={account.currency} className="text-[11px] font-semibold" />
                <ArrowUpRight className="h-3 w-3 text-subtle" />
              </Link>
            ))}
          </div>
        </Panel>
      </div>

      <section>
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h2 className="text-[16px] font-semibold tracking-tight">Your wallets</h2>
            <p className="text-[11.5px] text-muted">Open an account to inspect its ledger account and transaction history.</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {portfolio.accounts.map((account) => (
            <AccountTile key={account.id} account={account} />
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Panel title="Cards linked to accounts" description="Virtual cards and their current limits" action={<Link href="/app/cards" className="text-[10.5px] font-semibold text-primary hover:underline">Card studio</Link>}>
          {cards.length === 0 ? (
            <EmptyState title="No cards" description="Virtual card issuance is not enabled for this persona." />
          ) : (
            <div className="space-y-2.5">
              {cards.map((card) => (
                <div key={card.id} className="flex items-center gap-3 rounded-[10px] border border-border bg-surface px-3 py-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-soft text-primary">
                    <CreditCard className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-semibold">{card.label}</p>
                    <p className="mono text-[9px] text-subtle">•••• {card.last4} · {card.accountName}</p>
                  </div>
                  <Badge variant={card.status === "active" ? "success" : "danger"}>{card.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="How balances work" description="A short ledger orientation">
          <ol className="space-y-3">
            {[
              ["Postings, not numbers", "Each movement writes a journal with at least two signed postings. Customer balances are the negative sum of liability postings."],
              ["Holds reserve availability", "Processing payouts create a hold. Available balance is ledger balance minus active holds."],
              ["Corrections are journals", "Nothing is edited in place. A reversal creates a compensating journal that also balances to zero."],
            ].map(([title, body], index) => (
              <li key={title} className="flex gap-3">
                <span className="mono flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[9px] font-semibold text-muted">{index + 1}</span>
                <div>
                  <p className="text-[11.5px] font-semibold">{title}</p>
                  <p className="mt-0.5 text-[10.5px] leading-relaxed text-muted">{body}</p>
                </div>
              </li>
            ))}
          </ol>
          <Link href="/docs/ledger" className="mt-4 inline-flex items-center gap-1.5 text-[10.5px] font-semibold text-primary hover:underline">
            <BookOpenCheck className="h-3.5 w-3.5" /> Read the ledger specification
          </Link>
        </Panel>
      </section>

      <Disclosure>{portfolio.disclosure}</Disclosure>
    </div>
  );
}
