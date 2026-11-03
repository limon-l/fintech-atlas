"use client";

import { useActionState, useEffect, useState } from "react";
import { Check, CreditCard, Loader2, Plus, Send, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import type { AccountView } from "@/server/finance";
import {
  createBillAction,
  createInvoiceAction,
  createVendorAction,
  decideApprovalAction,
  payBillAction,
  recordInvoicePaymentAction,
  reimburseExpenseAction,
  sendInvoiceAction,
  submitExpenseAction,
  updateMemberRoleAction,
  voidInvoiceAction,
  type BusinessActionState,
} from "@/app/actions/business";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/badge";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { CURRENCY_CODES } from "@/domain/money";
import type { BusinessRole } from "@/domain/rbac";

const initial: BusinessActionState = {};

function useFeedback(state: BusinessActionState) {
  useEffect(() => {
    if (state.message) toast.success(state.message);
    if (state.error) toast.error(state.error);
  }, [state]);
}

function today(offsetDays = 0): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

/* -------------------------------------------------------------------------- */
/* Invoices                                                                   */
/* -------------------------------------------------------------------------- */

export function InvoiceCreateForm({
  customers,
  baseCurrency,
}: {
  customers: Array<{ id: string; name: string; currency: string }>;
  baseCurrency: string;
}) {
  const [state, action] = useActionState(createInvoiceAction, initial);
  const [open, setOpen] = useState(false);
  useFeedback(state);

  if (!open) {
    return (
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5" /> New invoice
      </Button>
    );
  }

  return (
    <form action={action} className="surface-card w-full space-y-3 p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-[14px] font-semibold">New invoice</h2>
        <Button type="button" variant="ghost" size="icon-sm" onClick={() => setOpen(false)} aria-label="Close">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Customer" htmlFor="invoice-customer">
          <Select id="invoice-customer" name="customerId" required>
            <option value="">Choose a customer</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>{customer.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Currency" htmlFor="invoice-currency">
          <Select id="invoice-currency" name="currency" defaultValue={baseCurrency}>
            {CURRENCY_CODES.map((code) => <option key={code} value={code}>{code}</option>)}
          </Select>
        </Field>
        <Field label="Issue date" htmlFor="invoice-issue">
          <Input id="invoice-issue" name="issueDate" type="date" defaultValue={today()} required />
        </Field>
        <Field label="Due date" htmlFor="invoice-due">
          <Input id="invoice-due" name="dueDate" type="date" defaultValue={today(14)} required />
        </Field>
      </div>
      <div className="space-y-2 rounded-[10px] border border-border bg-surface-2/40 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">Line items</p>
        {[0, 1, 2].map((index) => (
          <div key={index} className="grid gap-2 sm:grid-cols-[1fr_90px_120px]">
            <Input name="lineDescription" placeholder={index === 0 ? "Description" : "Optional line"} aria-label={`Line ${index + 1} description`} />
            <Input name="lineQuantity" defaultValue={index === 0 ? "1" : ""} placeholder="Qty" inputMode="decimal" aria-label={`Line ${index + 1} quantity`} />
            <Input name="lineUnitPrice" placeholder="Unit price" inputMode="decimal" aria-label={`Line ${index + 1} unit price`} />
          </div>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Tax (bps)" htmlFor="invoice-tax" hint="2000 = 20%">
          <Input id="invoice-tax" name="taxBps" inputMode="numeric" defaultValue="0" />
        </Field>
        <Field label="Discount" htmlFor="invoice-discount">
          <Input id="invoice-discount" name="discount" inputMode="decimal" placeholder="0.00" />
        </Field>
        <Field label="Notes" htmlFor="invoice-notes">
          <Input id="invoice-notes" name="notes" placeholder="Optional" />
        </Field>
      </div>
      <FormError message={state.error} />
      <div className="flex items-center gap-2">
        <SubmitButton pendingLabel="Creating…"><Plus className="h-3.5 w-3.5" /> Create draft</SubmitButton>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  );
}

export function InvoiceActions({
  invoice,
  accounts,
}: {
  invoice: { id: string; status: string; currency: string; dueMinor: number };
  accounts: AccountView[];
}) {
  const [paymentState, paymentAction] = useActionState(recordInvoicePaymentAction, initial);
  const [voidState, voidAction] = useActionState(voidInvoiceAction, initial);
  useFeedback(paymentState);
  useFeedback(voidState);
  const eligible = accounts.filter((account) => account.currency === invoice.currency && account.status === "active");

  return (
    <div className="space-y-4">
      {invoice.status === "draft" ? (
        <form action={sendInvoiceAction}>
          <input type="hidden" name="invoiceId" value={invoice.id} />
          <SubmitButton size="sm" pendingLabel="Sending…"><Send className="h-3.5 w-3.5" /> Send invoice</SubmitButton>
        </form>
      ) : null}

      {invoice.status === "sent" || invoice.status === "partially_paid" ? (
        <form action={paymentAction} className="space-y-3">
          <input type="hidden" name="invoiceId" value={invoice.id} />
          <input type="hidden" name="currency" value={invoice.currency} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Deposit account" htmlFor="invoice-account">
              <Select id="invoice-account" name="accountId" required>
                {eligible.length === 0 ? <option value="">No {invoice.currency} account</option> : null}
                {eligible.map((account) => (
                  <option key={account.id} value={account.id}>{account.name}</option>
                ))}
              </Select>
            </Field>
            <Field label={`Amount (${invoice.currency})`} htmlFor="invoice-amount">
              <Input id="invoice-amount" name="amount" inputMode="decimal" defaultValue={(invoice.dueMinor / 100).toFixed(2)} required />
            </Field>
          </div>
          <FormError message={paymentState.error} />
          <SubmitButton size="sm" pendingLabel="Posting…" disabled={eligible.length === 0}>
            <CreditCard className="h-3.5 w-3.5" /> Record payment
          </SubmitButton>
        </form>
      ) : null}

      {invoice.status === "draft" || invoice.status === "sent" ? (
        <form action={voidAction} className="space-y-2 border-t border-border/70 pt-3">
          <input type="hidden" name="invoiceId" value={invoice.id} />
          <Field label="Void reason" htmlFor="invoice-void">
            <Input id="invoice-void" name="reason" placeholder="Duplicate, wrong customer…" required />
          </Field>
          <FormError message={voidState.error} />
          <Button type="submit" variant="ghost" size="sm">Void invoice</Button>
        </form>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Vendors and bills                                                          */
/* -------------------------------------------------------------------------- */

export function VendorCreateForm({ baseCurrency }: { baseCurrency: string }) {
  const [state, action] = useActionState(createVendorAction, initial);
  useFeedback(state);
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Vendor name" htmlFor="vendor-name">
          <Input id="vendor-name" name="name" placeholder="Northstar Cloud" required />
        </Field>
        <Field label="Email" htmlFor="vendor-email">
          <Input id="vendor-email" name="email" type="email" placeholder="billing@vendor.example" />
        </Field>
        <Field label="Category" htmlFor="vendor-category">
          <Input id="vendor-category" name="category" defaultValue="Software" />
        </Field>
        <Field label="Currency" htmlFor="vendor-currency">
          <Select id="vendor-currency" name="currency" defaultValue={baseCurrency}>
            {CURRENCY_CODES.map((code) => <option key={code} value={code}>{code}</option>)}
          </Select>
        </Field>
      </div>
      <FormError message={state.error} />
      <SubmitButton size="sm" pendingLabel="Adding…"><Plus className="h-3.5 w-3.5" /> Add vendor</SubmitButton>
    </form>
  );
}

export function BillCreateForm({
  vendors,
  baseCurrency,
}: {
  vendors: Array<{ id: string; name: string; currency: string }>;
  baseCurrency: string;
}) {
  const [state, action] = useActionState(createBillAction, initial);
  useFeedback(state);
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Vendor" htmlFor="bill-vendor">
          <Select id="bill-vendor" name="vendorId" required>
            <option value="">Choose a vendor</option>
            {vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}
          </Select>
        </Field>
        <Field label="Bill number" htmlFor="bill-number">
          <Input id="bill-number" name="number" placeholder="INV-2291" required />
        </Field>
        <Field label="Amount" htmlFor="bill-amount">
          <Input id="bill-amount" name="amount" inputMode="decimal" placeholder="0.00" required />
        </Field>
        <Field label="Currency" htmlFor="bill-currency">
          <Select id="bill-currency" name="currency" defaultValue={baseCurrency}>
            {CURRENCY_CODES.map((code) => <option key={code} value={code}>{code}</option>)}
          </Select>
        </Field>
        <Field label="Issue date" htmlFor="bill-issue">
          <Input id="bill-issue" name="issueDate" type="date" defaultValue={today()} required />
        </Field>
        <Field label="Due date" htmlFor="bill-due">
          <Input id="bill-due" name="dueDate" type="date" defaultValue={today(21)} required />
        </Field>
        <Field label="Category" htmlFor="bill-category">
          <Input id="bill-category" name="category" defaultValue="Software" />
        </Field>
        <Field label="Description" htmlFor="bill-description">
          <Input id="bill-description" name="description" placeholder="Annual platform subscription" required />
        </Field>
      </div>
      <FormError message={state.error} />
      <SubmitButton size="sm" pendingLabel="Creating…"><Plus className="h-3.5 w-3.5" /> Create bill</SubmitButton>
      <p className="text-[10.5px] text-subtle">Creates a two-step approval: approver, then finance manager.</p>
    </form>
  );
}

export function BillPayForm({ bill, accounts }: { bill: { id: string; currency: string }; accounts: AccountView[] }) {
  const [state, action] = useActionState(payBillAction, initial);
  useFeedback(state);
  const eligible = accounts.filter((account) => account.currency === bill.currency && account.status === "active");
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="billId" value={bill.id} />
      <Field label="Pay from" htmlFor={`bill-account-${bill.id}`} className="min-w-[180px] flex-1">
        <Select id={`bill-account-${bill.id}`} name="accountId" required>
          {eligible.length === 0 ? <option value="">No {bill.currency} account</option> : null}
          {eligible.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
        </Select>
      </Field>
      <SubmitButton size="sm" variant="secondary" pendingLabel="Paying…" disabled={eligible.length === 0}>
        <Check className="h-3.5 w-3.5" /> Pay bill
      </SubmitButton>
      <FormError message={state.error} />
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* Expenses                                                                   */
/* -------------------------------------------------------------------------- */

export function ExpenseForm({ baseCurrency }: { baseCurrency: string }) {
  const [state, action] = useActionState(submitExpenseAction, initial);
  useFeedback(state);
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Merchant" htmlFor="expense-merchant">
          <Input id="expense-merchant" name="merchant" placeholder="Rail Europe" required />
        </Field>
        <Field label="Amount" htmlFor="expense-amount">
          <Input id="expense-amount" name="amount" inputMode="decimal" placeholder="0.00" required />
        </Field>
        <Field label="Category" htmlFor="expense-category">
          <Input id="expense-category" name="category" defaultValue="Travel" />
        </Field>
        <Field label="Currency" htmlFor="expense-currency">
          <Select id="expense-currency" name="currency" defaultValue={baseCurrency}>
            {CURRENCY_CODES.map((code) => <option key={code} value={code}>{code}</option>)}
          </Select>
        </Field>
        <Field label="Project (optional)" htmlFor="expense-project">
          <Input id="expense-project" name="project" placeholder="Atlas expansion" />
        </Field>
        <Field label="Receipt name (optional)" htmlFor="expense-receipt">
          <Input id="expense-receipt" name="receiptName" placeholder="rail-receipt.pdf" />
        </Field>
      </div>
      <FormError message={state.error} />
      <SubmitButton size="sm" pendingLabel="Submitting…"><Plus className="h-3.5 w-3.5" /> Submit expense</SubmitButton>
    </form>
  );
}

export function ExpenseReimburseForm({ expense, accounts }: { expense: { id: string; currency: string }; accounts: AccountView[] }) {
  const [state, action] = useActionState(reimburseExpenseAction, initial);
  useFeedback(state);
  const eligible = accounts.filter((account) => account.currency === expense.currency && account.status === "active");
  return (
    <form action={action} className="flex items-end gap-2">
      <input type="hidden" name="expenseId" value={expense.id} />
      <Field label="Reimburse from" htmlFor={`expense-account-${expense.id}`} className="min-w-[160px]">
        <Select id={`expense-account-${expense.id}`} name="accountId" required>
          {eligible.length === 0 ? <option value="">No {expense.currency} account</option> : null}
          {eligible.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
        </Select>
      </Field>
      <SubmitButton size="sm" variant="secondary" pendingLabel="Paying…" disabled={eligible.length === 0}>Reimburse</SubmitButton>
      <FormError message={state.error} />
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* Approvals                                                                  */
/* -------------------------------------------------------------------------- */

export function ApprovalDecisionForm({
  approvalId,
  disabled,
  decided,
  status,
}: {
  approvalId: string;
  disabled?: boolean;
  decided?: boolean;
  status?: string;
}) {
  const [state, action] = useActionState(decideApprovalAction, initial);
  const [decision, setDecision] = useState<"approve" | "reject">("approve");
  useFeedback(state);
  if (decided) {
    return (
      <div className="rounded-[10px] border border-border bg-surface-2/50 px-3 py-6 text-center">
        <StatusPill status={status ?? "approved"} />
        <p className="mt-2 text-[11px] text-muted">This request has already been decided.</p>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="approvalId" value={approvalId} />
      <input type="hidden" name="decision" value={decision} />
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant={decision === "approve" ? "primary" : "secondary"}
          size="sm"
          onClick={() => setDecision("approve")}
          disabled={disabled}
        >
          <Check className="h-3.5 w-3.5" /> Approve
        </Button>
        <Button
          type="button"
          variant={decision === "reject" ? "danger" : "secondary"}
          size="sm"
          onClick={() => setDecision("reject")}
          disabled={disabled}
        >
          <X className="h-3.5 w-3.5" /> Reject
        </Button>
      </div>
      <Field label="Decision comment" htmlFor={`approval-comment-${approvalId}`}>
        <Textarea id={`approval-comment-${approvalId}`} name="comment" placeholder="Document the rationale for the audit trail." required disabled={disabled} />
      </Field>
      <Field label="Authorization PIN" htmlFor={`approval-pin-${approvalId}`} hint="Demo PIN: 246810">
        <Input id={`approval-pin-${approvalId}`} name="pin" type="password" inputMode="numeric" maxLength={6} required disabled={disabled} />
      </Field>
      <FormError message={state.error} />
      <SubmitButton variant={decision === "reject" ? "danger" : "primary"} pendingLabel="Recording…" disabled={disabled}>
        <ShieldCheck className="h-3.5 w-3.5" /> {decision === "approve" ? "Approve step" : "Reject request"}
      </SubmitButton>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* Team                                                                       */
/* -------------------------------------------------------------------------- */

export function TeamRoleForm({ membershipId, role, disabled }: { membershipId: string; role: string; disabled?: boolean }) {
  const [state, action] = useActionState(updateMemberRoleAction, initial);
  useFeedback(state);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="membershipId" value={membershipId} />
      <Select name="role" defaultValue={role} disabled={disabled} className="h-8 w-[150px] text-[11px]" aria-label="Member role">
        {(["owner", "finance_manager", "approver", "employee"] as BusinessRole[]).map((value) => (
          <option key={value} value={value}>{value.replace("_", " ")}</option>
        ))}
      </Select>
      <Button type="submit" size="sm" variant="secondary" disabled={disabled}>
        {disabled ? <Loader2 className="h-3 w-3" /> : "Update"}
      </Button>
    </form>
  );
}
