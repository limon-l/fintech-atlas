import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, FileText } from "lucide-react";
import { getDb } from "@/db/client";
import { requireBusiness } from "@/lib/auth";
import { getInvoice } from "@/server/business";
import { listAccounts } from "@/server/finance";
import { PageHeader, Panel, SandboxNote, KeyValue, Disclosure } from "@/components/ui/misc";
import { Money } from "@/components/ui/money";
import { StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InvoiceActions } from "@/components/app/business-forms";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Invoice" };

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireBusiness("invoice:read");
  const db = getDb();
  const detail = getInvoice(db, ctx.orgId, id);
  if (!detail) notFound();
  const { invoice, lines } = detail;
  const accounts = listAccounts(db, "org", ctx.orgId);
  const dueMinor = invoice.total_minor - invoice.amount_paid_minor;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={`Business · ${ctx.orgName}`}
        title={invoice.number}
        description={`Issued ${formatDate(invoice.issue_date)} · due ${formatDate(invoice.due_date)}`}
        actions={
          <>
            <Button asChild variant="secondary" size="sm"><Link href="/business/invoices"><ArrowLeft className="h-3.5 w-3.5" /> All invoices</Link></Button>
            <StatusPill status={invoice.status} />
          </>
        }
      />
      <SandboxNote />

      <section className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <Panel title="Invoice document" description="Line items and totals" bodyClassName="p-0">
          <div className="border-b border-border/70 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="eyebrow">Bill to</p>
                <p className="mt-1 flex items-center gap-1.5 text-[14px] font-semibold"><Building2 className="h-4 w-4 text-muted" /> {invoice.customer_name}</p>
                <p className="mt-0.5 text-[11.5px] text-muted">{invoice.customer_email ?? "No email on file"} · {invoice.customer_country}</p>
              </div>
              <div className="text-right">
                <p className="eyebrow">Amount due</p>
                <p className="amount mt-1 text-[26px] font-semibold tracking-tight"><Money amountMinor={dueMinor} currency={invoice.currency} /></p>
                <p className="text-[10px] text-subtle">of <Money amountMinor={invoice.total_minor} currency={invoice.currency} /></p>
              </div>
            </div>
          </div>

          <div className="p-5">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-border text-left text-[10px] uppercase tracking-[0.08em] text-subtle">
                  <th className="pb-2 font-semibold">Description</th>
                  <th className="pb-2 text-right font-semibold">Qty</th>
                  <th className="pb-2 text-right font-semibold">Unit</th>
                  <th className="pb-2 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {lines.map((line) => (
                  <tr key={line.id}>
                    <td className="py-2.5">{line.description}</td>
                    <td className="py-2.5 text-right mono text-[11px]">{(line.quantity_milli / 1000).toLocaleString("en-US")}</td>
                    <td className="py-2.5 text-right"><Money amountMinor={line.unit_price_minor} currency={invoice.currency} /></td>
                    <td className="py-2.5 text-right font-semibold"><Money amountMinor={line.amount_minor} currency={invoice.currency} /></td>
                  </tr>
                ))}
              </tbody>
            </table>

            <dl className="ml-auto mt-4 w-full max-w-xs divide-y divide-border/60 text-[12px]">
              <KeyValue label="Subtotal" value={<Money amountMinor={invoice.subtotal_minor} currency={invoice.currency} />} />
              <KeyValue label="Tax" value={<Money amountMinor={invoice.tax_minor} currency={invoice.currency} />} />
              <KeyValue label="Discount" value={<Money amountMinor={-invoice.discount_minor} currency={invoice.currency} />} />
              <KeyValue label="Total" value={<Money amountMinor={invoice.total_minor} currency={invoice.currency} className="font-semibold" />} />
              <KeyValue label="Paid" value={<Money amountMinor={invoice.amount_paid_minor} currency={invoice.currency} />} />
            </dl>
            {invoice.notes ? <p className="mt-4 rounded-[9px] bg-surface-2 px-3 py-2 text-[11px] text-muted">{invoice.notes}</p> : null}
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel title="Collect payment" description="Posts a journal and marks the invoice paid">
            <InvoiceActions
              invoice={{ id: invoice.id, status: invoice.status, currency: invoice.currency, dueMinor }}
              accounts={accounts}
            />
          </Panel>
          <Panel title="Metadata" description="Immutable identifiers">
            <dl className="divide-y divide-border/70">
              <KeyValue label="Invoice id" value={<span className="mono text-[10.5px]">{invoice.id}</span>} />
              <KeyValue label="Customer id" value={<span className="mono text-[10.5px]">{invoice.customer_id}</span>} />
              <KeyValue label="Currency" value={invoice.currency} />
              <KeyValue label="Status" value={<StatusPill status={invoice.status} />} />
            </dl>
            <div className="mt-3 flex items-center gap-2 rounded-[9px] bg-info-soft px-3 py-2 text-[10.5px] text-info">
              <FileText className="h-3.5 w-3.5" /> Payment account currency must match the invoice currency.
            </div>
          </Panel>
        </div>
      </section>

      <Disclosure>This is a synthetic invoice. It is not a tax document and has no legal effect.</Disclosure>
    </div>
  );
}
