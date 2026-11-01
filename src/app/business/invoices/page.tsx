import Link from "next/link";
import { FileText, TrendingUp, CircleAlert, Clock } from "lucide-react";
import { getDb } from "@/db/client";
import { requireBusiness } from "@/lib/auth";
import { listInvoices } from "@/server/business";
import { PageHeader, SandboxNote, Panel, Stat, EmptyState, Disclosure } from "@/components/ui/misc";
import { Money } from "@/components/ui/money";
import { StatusPill, Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InvoiceCreateForm } from "@/components/app/business-forms";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Invoices" };

export default async function InvoicesPage() {
  const ctx = await requireBusiness("invoice:read");
  const db = getDb();
  const invoices = listInvoices(db, ctx.orgId);
  const customers = db
    .prepare("SELECT id, name FROM customers WHERE org_id = ? ORDER BY name ASC")
    .all(ctx.orgId) as Array<{ id: string; name: string }>;
  const outstanding = invoices.filter((invoice) => ["sent", "partially_paid"].includes(invoice.status));
  const outstandingMinor = outstanding.reduce((acc, invoice) => acc + invoice.dueMinor, 0);
  const overdue = outstanding.filter((invoice) => invoice.overdue);
  const paid = invoices.filter((invoice) => invoice.status === "paid");
  const currency = invoices[0]?.currency ?? ctx.baseCurrency;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Business · receivables"
        title="Invoices"
        description="Draft, send and collect. Recording a payment posts a balanced journal against the settlement account."
        actions={<InvoiceCreateForm customers={customers.map((customer) => ({ ...customer, currency: ctx.baseCurrency }))} baseCurrency={ctx.baseCurrency} />}
      />
      <SandboxNote />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Outstanding" value={<Money amountMinor={outstandingMinor} currency={currency} />} hint={`${outstanding.length} open invoice${outstanding.length === 1 ? "" : "s"}`} icon={<FileText className="h-4 w-4" />} />
        <Stat label="Overdue" value={overdue.length} hint={<Money amountMinor={overdue.reduce((acc, invoice) => acc + invoice.dueMinor, 0)} currency={currency} />} icon={<CircleAlert className="h-4 w-4" />} trend={overdue.length > 0 ? <Badge variant="danger">Chase</Badge> : <Badge variant="success">Clear</Badge>} />
        <Stat label="Collected" value={<Money amountMinor={paid.reduce((acc, invoice) => acc + invoice.paidMinor, 0)} currency={currency} />} hint={`${paid.length} paid`} icon={<TrendingUp className="h-4 w-4" />} />
        <Stat label="Drafts" value={invoices.filter((invoice) => invoice.status === "draft").length} hint="Not yet sent" icon={<Clock className="h-4 w-4" />} />
      </section>

      <Panel title="All invoices" description={`${invoices.length} records · newest first`} bodyClassName="p-0">
        {invoices.length === 0 ? (
          <EmptyState className="m-5" title="No invoices yet" description="Create a draft invoice to start the receivables cycle." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead>Due</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell>
                    <Link href={`/business/invoices/${invoice.id}`} className="font-semibold text-primary hover:underline">
                      {invoice.number}
                    </Link>
                  </TableCell>
                  <TableCell className="text-[12px]">{invoice.customer}</TableCell>
                  <TableCell><StatusPill status={invoice.overdue && invoice.status !== "paid" ? "overdue" : invoice.status} /></TableCell>
                  <TableCell className="text-[11.5px] text-muted">{formatDate(invoice.issueDate)}</TableCell>
                  <TableCell className="text-[11.5px] text-muted">{formatDate(invoice.dueDate)}</TableCell>
                  <TableCell className="text-right"><Money amountMinor={invoice.totalMinor} currency={invoice.currency} className="text-[12px] font-semibold" /></TableCell>
                  <TableCell className="text-right"><Money amountMinor={invoice.dueMinor} currency={invoice.currency} className="text-[12px]" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>

      <Disclosure>Invoices are sandbox documents. Sending writes a webhook event to the local queue; no email is delivered.</Disclosure>
    </div>
  );
}
