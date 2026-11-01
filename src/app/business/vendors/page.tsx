import Link from "next/link";
import { Building2, Mail, ReceiptText } from "lucide-react";
import { getDb } from "@/db/client";
import { requireBusiness } from "@/lib/auth";
import { listVendors } from "@/server/business";
import { PageHeader, SandboxNote, Panel, Stat, EmptyState, Disclosure } from "@/components/ui/misc";
import { Money } from "@/components/ui/money";
import { Badge, StatusPill } from "@/components/ui/badge";
import { VendorCreateForm } from "@/components/app/business-forms";

export const metadata = { title: "Vendors" };

export default async function VendorsPage() {
  const ctx = await requireBusiness("bill:read");
  const vendors = listVendors(getDb(), ctx.orgId);
  const totalMinor = vendors.reduce((acc, vendor) => acc + vendor.total_minor, 0);
  const currency = vendors[0]?.currency ?? ctx.baseCurrency;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Business · suppliers"
        title="Vendors"
        description="Supplier records used by bills and payables. Categories and currencies drive spend reporting."
        actions={<Link href="/business/bills" className="text-[12px] font-semibold text-primary hover:underline">Open bills →</Link>}
      />
      <SandboxNote />

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label="Vendors" value={vendors.length} hint="Active supplier records" icon={<Building2 className="h-4 w-4" />} />
        <Stat label="Billed to date" value={<Money amountMinor={totalMinor} currency={currency} />} hint="Across all vendor bills" icon={<ReceiptText className="h-4 w-4" />} />
        <Stat label="With email" value={vendors.filter((vendor) => vendor.email).length} hint="Remittance contact on file" icon={<Mail className="h-4 w-4" />} />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
        <Panel title="Vendor directory" description={`${vendors.length} records`}>
          {vendors.length === 0 ? (
            <EmptyState title="No vendors yet" description="Add a vendor to start creating bills." />
          ) : (
            <div className="space-y-2">
              {vendors.map((vendor) => (
                <div key={vendor.id} className="flex items-center gap-3 rounded-[10px] border border-border bg-surface px-3 py-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-primary-soft text-primary">
                    <Building2 className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[12.5px] font-semibold">{vendor.name}</p>
                      <StatusPill status={vendor.status} />
                    </div>
                    <p className="mt-0.5 text-[10px] text-muted">
                      {vendor.category} · {vendor.currency} · {vendor.bill_count} bill{vendor.bill_count === 1 ? "" : "s"}
                      {vendor.email ? ` · ${vendor.email}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <Money amountMinor={vendor.total_minor} currency={vendor.currency} className="text-[12px] font-semibold" />
                    <p className="text-[8.5px] text-subtle">total billed</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Add vendor" description="Written to the audit log">
          <VendorCreateForm baseCurrency={ctx.baseCurrency} />
          <div className="mt-4 rounded-[9px] bg-surface-2 px-3 py-2 text-[10.5px] leading-relaxed text-muted">
            <Badge variant="info" className="mr-1.5">Note</Badge>
            Vendor email is used for sandbox remittance metadata only. No email is sent.
          </div>
        </Panel>
      </section>

      <Disclosure>Vendor records are fictional. Names, emails and categories are seeded or user-entered demo data.</Disclosure>
    </div>
  );
}
