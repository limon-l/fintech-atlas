import Link from "next/link";
import { ArrowUpRight, Search, UserRoundCheck, Users } from "lucide-react";
import { getDb } from "@/db/client";
import { requireOps } from "@/lib/auth";
import { listCustomers } from "@/server/ops";
import { PageHeader, SandboxNote, Panel, Stat, EmptyState, Avatar, Disclosure } from "@/components/ui/misc";
import { Badge, StatusPill } from "@/components/ui/badge";
import { Input } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { formatDate, relativeTime } from "@/lib/utils";

export const metadata = { title: "Customers" };

export default async function OpsCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireOps("ops:read");
  const { q = "" } = await searchParams;
  const db = getDb();
  const customers = listCustomers(db, q);
  const verified = customers.filter((customer) => customer.kyc_status === "verified").length;
  const withCases = customers.filter((customer) => customer.case_count > 0).length;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Operations · customers"
        title="Customer directory"
        description="Synthetic identities, KYC status and account footprints. Open a profile to see balances, cases and recent activity."
      />
      <SandboxNote />

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label="Customers" value={customers.length} hint={q ? `Matching “${q}”` : "All synthetic identities"} icon={<Users className="h-4 w-4" />} />
        <Stat label="Verified" value={verified} hint="KYC status verified" icon={<UserRoundCheck className="h-4 w-4" />} />
        <Stat label="With open cases" value={withCases} hint="Compliance cases on file" />
      </section>

      <form className="flex flex-col gap-2 sm:flex-row" action="/ops/customers">
        <label className="sr-only" htmlFor="customer-search">Search customers</label>
        <Input id="customer-search" name="q" defaultValue={q} placeholder="Search by name or email…" className="sm:max-w-sm" />
        <SubmitButton variant="secondary">
          <Search className="h-3.5 w-3.5" /> Search
        </SubmitButton>
      </form>

      <Panel title="Directory" description={`${customers.length} identities`} bodyClassName="p-0">
        {customers.length === 0 ? (
          <EmptyState title="No customers found" description="Try a different name or email." className="m-5" />
        ) : (
          <div className="divide-y divide-border/70">
            {customers.map((customer) => (
              <Link
                key={customer.id}
                href={`/ops/customers/${customer.id}`}
                className="flex flex-col gap-3 px-5 py-3.5 transition-colors hover:bg-surface-2/60 sm:flex-row sm:items-center"
              >
                <Avatar initials={customer.initials} name={customer.name} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[12.5px] font-semibold">{customer.name}</p>
                    <StatusPill status={customer.status} />
                    <Badge variant={customer.kyc_status === "verified" ? "success" : "warning"}>{customer.kyc_status}</Badge>
                  </div>
                  <p className="mt-0.5 text-[10.5px] text-subtle">
                    {customer.email} · {customer.country} · joined {formatDate(customer.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-[10.5px] text-muted sm:justify-end">
                  <span>{customer.account_count} accounts</span>
                  <span className={customer.case_count > 0 ? "font-semibold text-warning" : undefined}>
                    {customer.case_count} cases
                  </span>
                  <span className="hidden w-20 text-right text-subtle md:inline">
                    {customer.last_login_at ? relativeTime(customer.last_login_at) : "Never signed in"}
                  </span>
                  <ArrowUpRight className="h-3.5 w-3.5 text-subtle" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </Panel>

      <Disclosure>Customer records are seeded for demonstration. No real personal data is stored.</Disclosure>
    </div>
  );
}
