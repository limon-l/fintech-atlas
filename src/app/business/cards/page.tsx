import Link from "next/link";
import { CreditCard, ShieldCheck, Snowflake, Users } from "lucide-react";
import { getDb } from "@/db/client";
import { requireBusiness } from "@/lib/auth";
import { getCards } from "@/server/finance";
import { canBusiness } from "@/domain/rbac";
import { PageHeader, SandboxNote, Panel, Stat, Disclosure } from "@/components/ui/misc";
import { Money } from "@/components/ui/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardStudio } from "@/components/app/card-studio";

export const metadata = { title: "Business cards" };

export default async function BusinessCardsPage() {
  const ctx = await requireBusiness("card:read");
  const cards = getCards(getDb(), "org", ctx.orgId);
  const frozen = cards.filter((card) => card.status === "frozen");
  const currency = cards[0]?.currency ?? ctx.baseCurrency;
  const canControl = canBusiness(ctx.role, "card:control");

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={`Business · ${ctx.orgName}`}
        title="Team cards"
        description="Organization cards with server-enforced limits and categories. Controls require the card-control permission."
        actions={
          <Button asChild variant="secondary" size="sm">
            <Link href="/business/team"><Users className="h-3.5 w-3.5" /> Team</Link>
          </Button>
        }
      />
      <SandboxNote />

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label="Cards" value={cards.length} hint={`${cards.length - frozen.length} active`} icon={<CreditCard className="h-4 w-4" />} />
        <Stat label="Frozen" value={frozen.length} hint="Authorizations declined" icon={<Snowflake className="h-4 w-4" />} trend={frozen.length > 0 ? <Badge variant="danger">Review</Badge> : <Badge variant="success">All clear</Badge>} />
        <Stat label="Monthly cap" value={<Money amountMinor={cards.reduce((acc, card) => acc + card.monthlyLimitMinor, 0)} currency={currency} />} hint="Sum of card limits" icon={<ShieldCheck className="h-4 w-4" />} />
      </section>

      {!canControl ? (
        <div className="rounded-[10px] border border-info/25 bg-info-soft px-3.5 py-2.5 text-[11.5px] text-info">
          Your role can view cards but not change controls. Ask an owner or finance manager for access.
        </div>
      ) : null}

      <CardStudio cards={cards} holder={ctx.orgName} />

      <Panel title="Control boundaries" description="What organization cards can and cannot do">
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ["Scoped to the org", "Cards belong to the organization. Every control call verifies active membership and permission."],
            ["Limits are hard caps", "Monthly and per-transaction limits are integers. Per-transaction cannot exceed monthly."],
            ["Frozen means declined", "Freezing sets a database status read on every authorization decision."],
            ["No live network", "Numbers, networks and authorization events are synthetic."],
          ].map(([title, body]) => (
            <div key={title} className="rounded-[10px] border border-border bg-surface-2/40 p-3">
              <p className="text-[11.5px] font-semibold">{title}</p>
              <p className="mt-1 text-[10.5px] leading-relaxed text-muted">{body}</p>
            </div>
          ))}
        </div>
      </Panel>

      <Disclosure>Business cards are sandbox artefacts. No issuer, card network or real authorization is involved.</Disclosure>
    </div>
  );
}
