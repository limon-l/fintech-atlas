import Link from "next/link";
import { ShieldCheck, Users } from "lucide-react";
import { getDb } from "@/db/client";
import { requireUser } from "@/lib/auth";
import { listBeneficiaries } from "@/server/transfers";
import { PageHeader, SandboxNote, Panel, Stat, Disclosure } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { BeneficiaryManager } from "@/components/app/beneficiary-manager";

export const metadata = { title: "Beneficiaries" };

export default async function BeneficiariesPage() {
  const user = await requireUser("/app/beneficiaries");
  const beneficiaries = listBeneficiaries(getDb(), "user", user.id);
  const banks = beneficiaries.filter((item) => item.type === "bank").length;
  const wallets = beneficiaries.filter((item) => item.type === "wallet").length;
  const peers = beneficiaries.filter((item) => item.type === "internal").length;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Personal · address book"
        title="Beneficiaries"
        description="Saved payout destinations. Identifiers are masked at rest and every creation is written to the audit log."
        actions={
          <Button asChild variant="secondary" size="sm">
            <Link href="/app/transfers/new"><ShieldCheck className="h-3.5 w-3.5" /> New transfer</Link>
          </Button>
        }
      />
      <SandboxNote />

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label="Total saved" value={beneficiaries.length} hint="Active destinations" icon={<Users className="h-4 w-4" />} />
        <Stat label="Bank accounts" value={banks} hint="External payouts" />
        <Stat label="Wallets & peers" value={wallets + peers} hint={`${peers} Atlas peer${peers === 1 ? "" : "s"}`} />
      </section>

      <BeneficiaryManager beneficiaries={beneficiaries} />

      <Panel title="Identifier handling" description="What this sandbox does and does not store">
        <ul className="grid gap-3 sm:grid-cols-2">
          {[
            ["Masked only", "The demo schema stores masked account and IBAN strings. Full numbers and CVVs are never persisted."],
            ["Owner scoped", "Beneficiaries belong to one user. Queries always filter by owner type and owner id."],
            ["Audited", "Creation writes an audit event with the beneficiary id, name and currency."],
            ["No payment network", "No real rails are connected. External transfers stay processing until simulated settlement."],
          ].map(([title, body]) => (
            <li key={title} className="rounded-[10px] border border-border bg-surface-2/40 p-3">
              <p className="text-[11.5px] font-semibold">{title}</p>
              <p className="mt-1 text-[10.5px] leading-relaxed text-muted">{body}</p>
            </li>
          ))}
        </ul>
      </Panel>

      <Disclosure>Beneficiaries are sandbox records. No real bank, wallet provider or payment network receives these details.</Disclosure>
    </div>
  );
}
