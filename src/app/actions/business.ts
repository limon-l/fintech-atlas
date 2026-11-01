"use server";

import { revalidatePath } from "next/cache";
import Decimal from "decimal.js";
import { getBusinessContext, verifyPin } from "@/lib/auth";
import { getDb } from "@/db/client";
import { DomainError } from "@/domain/errors";
import { parseMoneyToMinor } from "@/domain/money";
import type { BusinessRole } from "@/domain/rbac";
import type { BusinessActor } from "@/server/business";
import {
  createBill,
  createInvoice,
  createVendor,
  decideApproval,
  payBill,
  recordInvoicePayment,
  reimburseExpense,
  sendInvoice,
  submitExpense,
  updateMemberRole,
  voidInvoice,
} from "@/server/business";

export interface BusinessActionState {
  ok?: boolean;
  error?: string;
  message?: string;
}

function failure(error: unknown): BusinessActionState {
  if (error instanceof DomainError) return { error: error.message };
  if (error instanceof Error) return { error: error.message };
  return { error: "Something went wrong. Please try again." };
}

async function actor(): Promise<BusinessActor> {
  const ctx = await getBusinessContext();
  if (!ctx) throw new DomainError("FORBIDDEN", "A business workspace is required");
  return { user: ctx.user, orgId: ctx.orgId, role: ctx.role };
}

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function revalidateBusiness(...paths: string[]): void {
  for (const path of paths) revalidatePath(path);
  revalidatePath("/business", "layout");
}

/* -------------------------------------------------------------------------- */
/* Invoices                                                                   */
/* -------------------------------------------------------------------------- */

export async function createInvoiceAction(
  _previous: BusinessActionState,
  formData: FormData,
): Promise<BusinessActionState> {
  try {
    const ctx = await actor();
    const currency = text(formData, "currency") || "USD";
    const descriptions = formData.getAll("lineDescription").map(String);
    const quantities = formData.getAll("lineQuantity").map(String);
    const prices = formData.getAll("lineUnitPrice").map(String);
    const lines = descriptions
      .map((description, index) => {
        if (!description.trim()) return null;
        const quantity = quantities[index]?.trim() || "1";
        if (!/^\d+(\.\d{1,3})?$/.test(quantity)) {
          throw new DomainError("VALIDATION_ERROR", "Line quantities accept at most three decimals");
        }
        return {
          description: description.trim(),
          quantityMilli: new Decimal(quantity).times(1000).toDecimalPlaces(0).toNumber(),
          unitPriceMinor: parseMoneyToMinor(prices[index] ?? "0", currency),
        };
      })
      .filter((line): line is { description: string; quantityMilli: number; unitPriceMinor: number } => Boolean(line));
    if (lines.length === 0) return { error: "Add at least one line item." };

    const id = createInvoice(getDb(), ctx, {
      customerId: text(formData, "customerId"),
      issueDate: new Date(text(formData, "issueDate") || Date.now()).toISOString(),
      dueDate: new Date(text(formData, "dueDate") || Date.now()).toISOString(),
      currency,
      taxBps: Math.round(Number(text(formData, "taxBps") || "0")),
      discountMinor: text(formData, "discount") ? parseMoneyToMinor(text(formData, "discount"), currency) : 0,
      notes: text(formData, "notes") || undefined,
      lines,
    });
    revalidateBusiness("/business/invoices", "/business", "/business/approvals");
    return { ok: true, message: `Draft invoice created (${id}).` };
  } catch (error) {
    return failure(error);
  }
}

export async function sendInvoiceAction(formData: FormData): Promise<void> {
  const ctx = await actor();
  sendInvoice(getDb(), ctx, text(formData, "invoiceId"));
  revalidateBusiness("/business/invoices");
}

export async function recordInvoicePaymentAction(
  _previous: BusinessActionState,
  formData: FormData,
): Promise<BusinessActionState> {
  try {
    const ctx = await actor();
    const currency = text(formData, "currency") || "USD";
    recordInvoicePayment(getDb(), ctx, {
      invoiceId: text(formData, "invoiceId"),
      accountId: text(formData, "accountId"),
      amountMinor: parseMoneyToMinor(text(formData, "amount"), currency),
    });
    revalidateBusiness("/business/invoices", "/business", "/business/reports");
    return { ok: true, message: "Payment recorded and posted to the ledger." };
  } catch (error) {
    return failure(error);
  }
}

export async function voidInvoiceAction(
  _previous: BusinessActionState,
  formData: FormData,
): Promise<BusinessActionState> {
  try {
    const ctx = await actor();
    voidInvoice(getDb(), ctx, text(formData, "invoiceId"), text(formData, "reason") || "Voided by finance");
    revalidateBusiness("/business/invoices");
    return { ok: true, message: "Invoice voided." };
  } catch (error) {
    return failure(error);
  }
}

/* -------------------------------------------------------------------------- */
/* Vendors and bills                                                          */
/* -------------------------------------------------------------------------- */

export async function createVendorAction(
  _previous: BusinessActionState,
  formData: FormData,
): Promise<BusinessActionState> {
  try {
    const ctx = await actor();
    const name = text(formData, "name");
    if (name.length < 2) return { error: "Enter a vendor name." };
    createVendor(getDb(), ctx, {
      name,
      email: text(formData, "email") || undefined,
      category: text(formData, "category") || "Software",
      currency: text(formData, "currency") || "USD",
    });
    revalidateBusiness("/business/vendors", "/business/bills");
    return { ok: true, message: "Vendor added." };
  } catch (error) {
    return failure(error);
  }
}

export async function createBillAction(
  _previous: BusinessActionState,
  formData: FormData,
): Promise<BusinessActionState> {
  try {
    const ctx = await actor();
    const currency = text(formData, "currency") || "USD";
    createBill(getDb(), ctx, {
      vendorId: text(formData, "vendorId"),
      number: text(formData, "number"),
      issueDate: new Date(text(formData, "issueDate") || Date.now()).toISOString(),
      dueDate: new Date(text(formData, "dueDate") || Date.now()).toISOString(),
      amountMinor: parseMoneyToMinor(text(formData, "amount"), currency),
      currency,
      category: text(formData, "category") || "Software",
      description: text(formData, "description"),
    });
    revalidateBusiness("/business/bills", "/business/approvals", "/business");
    return { ok: true, message: "Bill created and routed for two-step approval." };
  } catch (error) {
    return failure(error);
  }
}

export async function payBillAction(
  _previous: BusinessActionState,
  formData: FormData,
): Promise<BusinessActionState> {
  try {
    const ctx = await actor();
    payBill(getDb(), ctx, {
      billId: text(formData, "billId"),
      accountId: text(formData, "accountId"),
    });
    revalidateBusiness("/business/bills", "/business", "/business/reports");
    return { ok: true, message: "Bill paid. Journal posted." };
  } catch (error) {
    return failure(error);
  }
}

/* -------------------------------------------------------------------------- */
/* Expenses                                                                   */
/* -------------------------------------------------------------------------- */

export async function submitExpenseAction(
  _previous: BusinessActionState,
  formData: FormData,
): Promise<BusinessActionState> {
  try {
    const ctx = await actor();
    const currency = text(formData, "currency") || "USD";
    submitExpense(getDb(), ctx, {
      merchant: text(formData, "merchant"),
      category: text(formData, "category") || "Software",
      amountMinor: parseMoneyToMinor(text(formData, "amount"), currency),
      currency,
      project: text(formData, "project") || undefined,
      receiptName: text(formData, "receiptName") || undefined,
    });
    revalidateBusiness("/business/expenses", "/business/approvals");
    return { ok: true, message: "Expense submitted for approval." };
  } catch (error) {
    return failure(error);
  }
}

export async function reimburseExpenseAction(
  _previous: BusinessActionState,
  formData: FormData,
): Promise<BusinessActionState> {
  try {
    const ctx = await actor();
    reimburseExpense(getDb(), ctx, {
      expenseId: text(formData, "expenseId"),
      accountId: text(formData, "accountId"),
    });
    revalidateBusiness("/business/expenses", "/business", "/business/reports");
    return { ok: true, message: "Expense reimbursed from the selected account." };
  } catch (error) {
    return failure(error);
  }
}

/* -------------------------------------------------------------------------- */
/* Approvals and team                                                         */
/* -------------------------------------------------------------------------- */

export async function decideApprovalAction(
  _previous: BusinessActionState,
  formData: FormData,
): Promise<BusinessActionState> {
  try {
    const ctx = await actor();
    const pin = text(formData, "pin");
    const pinVerified = pin.length > 0 ? await verifyPin(ctx.user.id, pin) : false;
    if (!pinVerified) return { error: "That authorization PIN is incorrect." };
    const decision = text(formData, "decision") === "reject" ? "reject" : "approve";
    decideApproval(getDb(), ctx, {
      approvalId: text(formData, "approvalId"),
      decision,
      comment: text(formData, "comment"),
      pinVerified,
    });
    revalidateBusiness("/business/approvals", "/business", "/business/bills", "/business/expenses");
    return { ok: true, message: decision === "approve" ? "Approval recorded." : "Request rejected." };
  } catch (error) {
    return failure(error);
  }
}

export async function updateMemberRoleAction(
  _previous: BusinessActionState,
  formData: FormData,
): Promise<BusinessActionState> {
  try {
    const ctx = await actor();
    updateMemberRole(getDb(), ctx, {
      membershipId: text(formData, "membershipId"),
      role: text(formData, "role") as BusinessRole,
    });
    revalidateBusiness("/business/team");
    return { ok: true, message: "Role updated." };
  } catch (error) {
    return failure(error);
  }
}
