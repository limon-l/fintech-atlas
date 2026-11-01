import Link from "next/link";
import { CalendarClock, CircleAlert, ReceiptText, Wallet } from "lucide-react";
import { getDb } from "@/db/client";
import { requireBusiness } from "@/lib/auth";
import { listBills, listVendors } from "@/server/business";
import { listAccounts } from "@/server/finance";
import { PageHeader, SandboxNote, Panel, Stat, EmptyState, Disclosure } from "@/components/ui/misc";
import { Money } from "@/components/ui/money";
import { StatusPill, Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BillCreateForm, BillPayForm } from "@/components/app/business-forms";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Bills" };

export default async function BillsPage() {
  const ctx = await requireBusiness("bill:read");
  const db = getDb();
  const bills = listBills(db, ctx.orgId);
  const vendors = listVendors(db, ctx.orgId);
  const accounts = listAccounts(db, "org", ctx.orgId);
  const outstanding = bills.filter((bill) => ["awaiting_approval", "approved", "scheduled", "overdue"].includes(bill.status));
  const currency = bills[0]?.currency ?? ctx.baseCurrency;
  const payable = bills.filter((bill) => ["approved", "scheduled"].includes(bill.status));

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Business · payables"
        title="Bills"
        description="Every bill enters a two-step approval before it can be paid. Paying debits the treasury account and credits settlement."
        actions={
          <Link href="/business/vendors" className="text-[12px] font-semibold text-primary hover:underline">
            Manage vendors →
          </Link>
        }
      />
      <SandboxNote />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Open payables" value={<Money amountMinor={outstanding.reduce((acc, bill) => acc + bill.amountMinor, 0)} currency={currency} />} hint={`${outstanding.length} bill${outstanding.length === 1 ? "" : "s"}`} icon={<ReceiptText className="h-4 w-4" />} />
        <Stat label="Ready to pay" value={payable.length} hint="Approved or scheduled" icon={<Wallet className="h-4 w-4" />} trend={payable.length > 0 ? <Badge variant="primary">Action</Badge> : null} />
        <Stat label="Overdue" value={bills.filter((bill) => bill.overdue).length} hint="Past due date" icon={<CircleAlert className="h-4 w-4" />} trend={bills.some((bill) => bill.overdue) ? <Badge variant="danger">Review</Badge> : <Badge variant="success">Clear</Badge>} />
        <Stat label="Vendors" value={vendors.length} hint="Active suppliers" icon={<CalendarClock className="h-4 w-4" />} />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.5fr_0.9fr]">
        <Panel title="All bills" description={`${bills.length} records · earliest due first`} bodyClassName="p-0">
          {bills.length === 0 ? (
            <EmptyState className="m-5" title="No bills yet" description="Create a bill to route it through approvals." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bill</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Pay</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bills.map((bill) => (
                  <TableRow key={bill.id}>
                    <TableCell>
                      <p className="font-semibold">{bill.number}</p>
                      <p className="text-[10px] text-subtle">{bill.category}</p>
                    </TableCell>
                    <TableCell className="text-[12px]">{bill.vendor}</TableCell>
                    <TableCell><StatusPill status={bill.overdue && bill.status !== "paid" ? "overdue" : bill.status} /></TableCell>
                    <TableCell className="text-[11.5px] text-muted">{formatDate(bill.dueDate)}</TableCell>
                    <TableCell className="text-right"><Money amountMinor={bill.amountMinor} currency={bill.currency} className="text-[12px] font-semibold" /></TableCell>
                    <TableCell>
                      {["approved", "scheduled"].includes(bill.status) ? (
                        <BillPayForm bill={{ id: bill.id, currency: bill.currency }} accounts={accounts} />
                      ) : (
                        <span className="text-[10px] text-subtle">Awaiting approval</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Panel>

        <Panel title="New bill" description="Creates an approval request">
          {vendors.length === 0 ? (
            <EmptyState title="Add a vendor first" description="Bills must be linked to an organization vendor." action={<Link href="/business/vendors" className="text-[12px] font-semibold text-primary hover:underline">Open vendors →</Link>} />
          ) : (
            <BillCreateForm vendors={vendors.map((vendor) => ({ id: vendor.id, name: vendor.name, currency: vendor.currency }))} baseCurrency={ctx.baseCurrency} />
          )}
        </Panel>
      </section>

      <Disclosure>Bills and payments are synthetic. No supplier is paid and no live bank rail is contacted.</Disclosure>
    </div>
  );
}
