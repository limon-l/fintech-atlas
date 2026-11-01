import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { getDb } from "@/db/client";
import { requireUser } from "@/lib/auth";
import { listAccounts } from "@/server/finance";
import { listBeneficiaries } from "@/server/transfers";
import { PageHeader, SandboxNote, Disclosure } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { TransferComposer } from "@/components/app/transfer-composer";

export const metadata = { title: "New transfer" };

export default async function NewTransferPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const user = await requireUser("/app/transfers/new");
  const db = getDb();
  const accounts = listAccounts(db, "user", user.id).filter((account) => account.status === "active");
  const beneficiaries = listBeneficiaries(db, "user", user.id);
  const from = typeof query.from === "string" ? query.from : undefined;
  const mode = query.mode === "external" || query.mode === "fx" || query.mode === "internal" ? query.mode : undefined;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Personal · new transfer"
        title="Move money"
        description="Choose a route, review the total debit, then authorize with your PIN. Every route writes to the same double-entry ledger."
        actions={
          <>
            <Button asChild variant="secondary" size="sm"><Link href="/app/transfers">Transfers</Link></Button>
            <Button asChild variant="ghost" size="sm"><Link href="/app/beneficiaries"><ShieldCheck className="h-3.5 w-3.5" /> Beneficiaries</Link></Button>
          </>
        }
      />
      <SandboxNote />
      {accounts.length === 0 ? (
        <div className="surface-card p-6 text-center">
          <p className="text-sm font-semibold">No active personal wallets</p>
          <p className="mt-1 text-[12px] text-muted">This persona cannot initiate transfers. Sign in as Maya Chen to use the customer flow.</p>
        </div>
      ) : (
        <TransferComposer accounts={accounts} beneficiaries={beneficiaries} initialFrom={from} initialMode={mode} />
      )}
      <Disclosure>
        Transfers are simulated. Internal movements settle instantly in the sandbox; external payouts remain
        processing until an operator or provider callback settles them.
      </Disclosure>
    </div>
  );
}
