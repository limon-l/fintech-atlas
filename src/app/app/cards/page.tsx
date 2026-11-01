import Link from "next/link";
import { CreditCard, Plus, ShieldCheck, Snowflake, Wallet } from "lucide-react";
import { getDb } from "@/db/client";
import { requireUser } from "@/lib/auth";
import { getCards } from "@/server/finance";
import { PageHeader, SandboxNote, Panel, Stat, Disclosure, EmptyState } from "@/components/ui/misc";
import { Money } from "@/components/ui/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardStudio } from "@/components/app/card-studio";
import { monthKey } from "@/lib/utils";

export const metadata = { title: "Cards" };

export default async function CardsPage() {
  const user = await requireUser("/app/cards");
  const db = getDb();
  const cards = getCards(db, "user", user.id);
  const frozen = cards.filter((card) => card.status === "frozen").length;
  const spent = cards.reduce((acc, card) => acc + card.spentThisMonthMinor, 0);
  const limit = cards.reduce((acc, card) => acc + card.monthlyLimitMinor, 0);
  const currency = cards[0]?.currency ?? "USD";

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Personal · card studio"
        title="Cards"
        description="Issue, freeze and cap virtual cards. Controls are enforced server-side and every change is audited."
        actions={
          <Button asChild variant="secondary" size="sm">
            <Link href="/app/settings"><Plus className="h-3.5 w-3.5" /> Request a card</Link>
          </Button>
        }
      />
      <SandboxNote />

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label="Active cards" value={cards.length - frozen} hint={`${cards.length} issued`} icon={<CreditCard className="h-4 w-4" />} />
        <Stat label="Frozen" value={frozen} hint="Authorizations declined" icon={<Snowflake className="h-4 w-4" />} trend={frozen > 0 ? <Badge variant="danger">Review</Badge> : <Badge variant="success">All clear</Badge>} />
        <Stat
          label="Spend this month"
          value={<Money amountMinor={spent} currency={currency} />}
          hint={`of ${(limit / 100).toLocaleString("en-US", { style: "currency", currency })} across cards`}
          icon={<Wallet className="h-4 w-4" />}
        />
      </section>

      <CardStudio cards={cards} holder={user.name} />

      <section className="grid gap-4 lg:grid-cols-2">
        <Panel title="Control model" description="What freezing actually does">
          <ul className="space-y-3">
            {[
              ["Server-enforced", "The card status is read from the database on every authorization decision — never from the client."],
              ["Limits are integers", "Monthly and per-transaction caps are stored in minor units. Per-transaction cannot exceed monthly."],
              ["Audited changes", "Freeze, unfreeze and limit changes write an audit event with before/after metadata."],
              ["Sandbox only", "No real card network, PAN, CVV or issuer is involved. Numbers are synthetic."],
            ].map(([title, body], index) => (
              <li key={title} className="flex gap-3">
                <span className="mono flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[9px] font-semibold text-muted">{index + 1}</span>
                <div><p className="text-[11.5px] font-semibold">{title}</p><p className="mt-0.5 text-[10.5px] leading-relaxed text-muted">{body}</p></div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Card activity" description={`Current statement cycle · ${monthKey()}`}>
          {cards.length === 0 ? (
            <EmptyState title="No card activity" />
          ) : (
            <div className="space-y-3">
              {cards.map((card) => (
                <div key={card.id} className="flex items-center gap-3 rounded-[10px] border border-border bg-surface px-3 py-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-soft text-primary"><CreditCard className="h-3.5 w-3.5" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-semibold">{card.label} · •••• {card.last4}</p>
                    <p className="text-[9px] text-subtle">{card.accountName} · {card.allowedCategories.length} allowed categories</p>
                  </div>
                  <div className="text-right">
                    <Money amountMinor={card.spentThisMonthMinor} currency={card.currency} className="text-[11px] font-semibold" />
                    <p className="text-[8.5px] text-subtle">of <Money amountMinor={card.monthlyLimitMinor} currency={card.currency} compact /></p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 flex items-center gap-2 rounded-[9px] bg-success-soft px-3 py-2 text-[10.5px] text-success">
            <ShieldCheck className="h-3.5 w-3.5" /> Controls are enforced inside the server, not in the browser.
          </div>
        </Panel>
      </section>

      <Disclosure>Cards are sandbox artefacts. No live card network is connected and no real authorization can occur.</Disclosure>
    </div>
  );
}
