import Link from "next/link";
import { ArrowLeftRight, Globe2, ShieldCheck, TrendingUp } from "lucide-react";
import { getDb } from "@/db/client";
import { requireUser } from "@/lib/auth";
import { listAccounts } from "@/server/finance";
import { listTransfers, previewRate } from "@/server/transfers";
import { SANDBOX_RATE_SNAPSHOT } from "@/domain/fx";
import { PageHeader, SandboxNote, Panel, Stat, Disclosure, EmptyState } from "@/components/ui/misc";
import { Money } from "@/components/ui/money";
import { Badge, StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FxConverter } from "@/components/app/fx-converter";
import { formatDateTime } from "@/lib/utils";
import { CURRENCY_CODES, formatRate } from "@/domain/money";

export const metadata = { title: "FX" };

export default async function FxPage() {
  const user = await requireUser("/app/fx");
  const db = getDb();
  const accounts = listAccounts(db, "user", user.id);
  const fxTransfers = listTransfers(db, user.id, 40).filter((transfer) => transfer.direction === "fx").slice(0, 6);
  const rates = ["USD", "EUR", "GBP", "JPY", "CHF"].filter((code) => code !== "USD");

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Personal · currency"
        title="FX studio"
        description="Convert between your own multi-currency wallets with an indicative quote, an explicit fee and a PIN-authorized posting."
        actions={
          <Button asChild variant="secondary" size="sm">
            <Link href="/app/transfers?direction=fx"><ArrowLeftRight className="h-3.5 w-3.5" /> FX history</Link>
          </Button>
        }
      />
      <SandboxNote />

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Wallets"
          value={accounts.length}
          hint={`${new Set(accounts.map((account) => account.currency)).size} currencies`}
          icon={<Globe2 className="h-4 w-4" />}
        />
        <Stat
          label="Conversions"
          value={fxTransfers.length}
          hint="Most recent FX postings"
          icon={<ArrowLeftRight className="h-4 w-4" />}
        />
        <Stat
          label="Rate snapshot"
          value={formatDateTime(SANDBOX_RATE_SNAPSHOT.asOf).split(",")[0] ?? "Sandbox"}
          hint="Synthetic, not a market quote"
          icon={<TrendingUp className="h-4 w-4" />}
          trend={<Badge variant="warning">Indicative</Badge>}
        />
      </section>

      {accounts.length < 2 ? (
        <EmptyState
          title="A second wallet is required"
          description="FX needs at least two wallets in different currencies. Sign in as Maya Chen to use the seeded USD, EUR, GBP and JPY wallets."
        />
      ) : (
        <FxConverter accounts={accounts} />
      )}

      <section className="grid gap-4 lg:grid-cols-2">
        <Panel title="Rate board" description="Indicative mid-rates from the sandbox snapshot">
          <div className="space-y-2">
            {rates.map((code) => (
              <div key={code} className="flex items-center justify-between rounded-[9px] border border-border bg-surface px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="mono flex h-6 w-9 items-center justify-center rounded bg-surface-2 text-[9px] font-semibold">{code}</span>
                  <span className="text-[11.5px] text-muted">1 USD</span>
                </div>
                <span className="mono text-[11.5px] font-semibold">{formatRate(previewRate("USD", code), "USD", code)}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[10px] leading-relaxed text-subtle">
            {SANDBOX_RATE_SNAPSHOT.source}. Rates are deterministic fixtures, not live market data.
          </p>
        </Panel>

        <Panel title="Recent conversions" description="Every row links to its balanced journal">
          {fxTransfers.length === 0 ? (
            <EmptyState title="No conversions yet" description="Your first FX conversion will appear here." />
          ) : (
            <div className="space-y-2">
              {fxTransfers.map((transfer) => (
                <Link
                  key={transfer.id}
                  href={`/app/transfers/${transfer.id}`}
                  className="flex items-center gap-3 rounded-[10px] border border-border bg-surface px-3 py-2.5 transition-colors hover:bg-surface-2"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-soft text-primary">
                    <ArrowLeftRight className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-semibold">{transfer.reference}</p>
                    <p className="text-[9px] text-subtle">
                      <Money amountMinor={transfer.sourceAmountMinor} currency={transfer.sourceCurrency} compact /> →{" "}
                      <Money amountMinor={transfer.targetAmountMinor ?? 0} currency={transfer.targetCurrency ?? transfer.sourceCurrency} compact />
                    </p>
                  </div>
                  <div className="text-right">
                    <StatusPill status={transfer.status} />
                    <p className="mt-1 text-[8.5px] text-subtle">{formatDateTime(transfer.createdAt).split(",")[0]}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Panel>
      </section>

      <Panel title="How the conversion posts" description="Three journals, each balanced per currency">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ["Source leg", "Debit the source wallet, credit the FX clearing account in the source currency."],
            ["Target leg", "Debit FX clearing, credit the destination wallet in the target currency."],
            ["Fee leg", "If a fee applies, debit the source wallet and credit fee income — never mixed into the rate."],
          ].map(([title, body], index) => (
            <div key={title} className="rounded-[10px] border border-border bg-surface-2/50 p-3">
              <div className="flex items-center gap-2">
                <span className="mono flex h-5 w-5 items-center justify-center rounded-full bg-surface text-[9px] font-semibold text-muted">{index + 1}</span>
                <p className="text-[11.5px] font-semibold">{title}</p>
              </div>
              <p className="mt-1.5 text-[10.5px] leading-relaxed text-muted">{body}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-[9px] bg-success-soft px-3 py-2 text-[10.5px] text-success">
          <ShieldCheck className="h-3.5 w-3.5" /> Every journal must sum to zero per currency before it can commit.
        </div>
      </Panel>

      <Disclosure>
        FX in ATLAS is a sandbox simulation using fixed synthetic rates ({CURRENCY_CODES.length} supported currencies).
        It is not a quote, a trade, or a financial service.
      </Disclosure>
    </div>
  );
}
