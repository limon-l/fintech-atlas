"use server";

import { revalidatePath } from "next/cache";
import { requireOps, verifyPin } from "@/lib/auth";
import { getDb } from "@/db/client";
import { DomainError } from "@/domain/errors";
import { parseMoneyToMinor } from "@/domain/money";
import {
  postAdjustment,
  replayWebhook,
  resolveReconciliationItem,
  reverseJournalByOps,
  runReconciliation,
  settlePayoutByOps,
  failPayoutByOps,
  updateComplianceCase,
  updateRiskEvent,
  updateSupportTicket,
} from "@/server/ops";

export interface OpsActionState {
  ok?: boolean;
  error?: string;
  message?: string;
}

function failure(error: unknown): OpsActionState {
  if (error instanceof DomainError) return { error: error.message };
  if (error instanceof Error) return { error: error.message };
  return { error: "Something went wrong. Please try again." };
}

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

async function authorizePin(userId: string, pin: string): Promise<string | null> {
  if (!pin) return "Enter your authorization PIN to continue.";
  const valid = await verifyPin(userId, pin);
  return valid ? null : "That authorization PIN is incorrect.";
}

function revalidateOps(...paths: string[]): void {
  for (const path of paths) revalidatePath(path);
  revalidatePath("/ops", "layout");
}

/* -------------------------------------------------------------------------- */
/* Risk and compliance                                                        */
/* -------------------------------------------------------------------------- */

export async function reviewRiskAction(
  _previous: OpsActionState,
  formData: FormData,
): Promise<OpsActionState> {
  try {
    const actor = await requireOps("ops:risk");
    const pinError = await authorizePin(actor.id, text(formData, "pin"));
    if (pinError) return { error: pinError };
    const status = text(formData, "status");
    if (!["reviewing", "cleared", "escalated"].includes(status)) {
      return { error: "Choose a valid review outcome." };
    }
    updateRiskEvent(getDb(), actor, {
      riskId: text(formData, "riskId"),
      status: status as "reviewing" | "cleared" | "escalated",
      note: text(formData, "note"),
    });
    revalidateOps("/ops/risk", "/ops/audit");
    return { ok: true, message: `Risk event marked ${status}.` };
  } catch (error) {
    return failure(error);
  }
}

export async function reviewComplianceAction(
  _previous: OpsActionState,
  formData: FormData,
): Promise<OpsActionState> {
  try {
    const actor = await requireOps("ops:compliance");
    const pinError = await authorizePin(actor.id, text(formData, "pin"));
    if (pinError) return { error: pinError };
    const status = text(formData, "status");
    if (!["reviewing", "info_requested", "approved", "rejected"].includes(status)) {
      return { error: "Choose a valid case decision." };
    }
    updateComplianceCase(getDb(), actor, {
      caseId: text(formData, "caseId"),
      status: status as "reviewing" | "info_requested" | "approved" | "rejected",
      note: text(formData, "note"),
    });
    revalidateOps("/ops/compliance", "/ops/audit");
    return { ok: true, message: `Compliance case marked ${status.replace("_", " ")}.` };
  } catch (error) {
    return failure(error);
  }
}

/* -------------------------------------------------------------------------- */
/* Support                                                                    */
/* -------------------------------------------------------------------------- */

export async function updateSupportTicketAction(
  _previous: OpsActionState,
  formData: FormData,
): Promise<OpsActionState> {
  try {
    const actor = await requireOps("ops:read");
    const status = text(formData, "status");
    const priority = text(formData, "priority");
    if (!["open", "pending", "resolved"].includes(status)) return { error: "Choose a valid ticket status." };
    if (!["low", "normal", "high"].includes(priority)) return { error: "Choose a valid priority." };
    updateSupportTicket(getDb(), actor, {
      ticketId: text(formData, "ticketId"),
      status: status as "open" | "pending" | "resolved",
      priority: priority as "low" | "normal" | "high",
    });
    revalidateOps("/ops/support", "/ops/audit");
    return { ok: true, message: "Support ticket updated." };
  } catch (error) {
    return failure(error);
  }
}

/* -------------------------------------------------------------------------- */
/* Reconciliation                                                             */
/* -------------------------------------------------------------------------- */

export async function runReconciliationAction(
  _previous: OpsActionState,
  _formData: FormData,
): Promise<OpsActionState> {
  try {
    const actor = await requireOps("ops:reconcile");
    const result = runReconciliation(getDb(), actor);
    revalidateOps("/ops/reconciliation", "/ops/audit");
    return {
      ok: true,
      message:
        result.exceptions === 0
          ? "Reconciliation completed with no exceptions."
          : `Reconciliation completed with ${result.exceptions} exception${result.exceptions === 1 ? "" : "s"}.`,
    };
  } catch (error) {
    return failure(error);
  }
}

export async function resolveReconciliationAction(
  _previous: OpsActionState,
  formData: FormData,
): Promise<OpsActionState> {
  try {
    const actor = await requireOps("ops:reconcile");
    const pinError = await authorizePin(actor.id, text(formData, "pin"));
    if (pinError) return { error: pinError };
    const status = text(formData, "status");
    if (!["investigating", "resolved"].includes(status)) return { error: "Choose a valid item outcome." };
    resolveReconciliationItem(getDb(), actor, {
      itemId: text(formData, "itemId"),
      status: status as "investigating" | "resolved",
      note: text(formData, "note"),
    });
    revalidateOps("/ops/reconciliation", "/ops/audit");
    return { ok: true, message: `Reconciliation item marked ${status}.` };
  } catch (error) {
    return failure(error);
  }
}

/* -------------------------------------------------------------------------- */
/* Ledger                                                                     */
/* -------------------------------------------------------------------------- */

export async function reverseJournalAction(
  _previous: OpsActionState,
  formData: FormData,
): Promise<OpsActionState> {
  try {
    const actor = await requireOps("ops:ledger");
    const pinError = await authorizePin(actor.id, text(formData, "pin"));
    if (pinError) return { error: pinError };
    reverseJournalByOps(getDb(), actor, text(formData, "journalId"), text(formData, "reason"));
    revalidateOps("/ops/ledger", "/ops/audit", "/ops/health");
    return { ok: true, message: "Reversal journal posted." };
  } catch (error) {
    return failure(error);
  }
}

export async function postAdjustmentAction(
  _previous: OpsActionState,
  formData: FormData,
): Promise<OpsActionState> {
  try {
    const actor = await requireOps("ops:ledger");
    const pinError = await authorizePin(actor.id, text(formData, "pin"));
    if (pinError) return { error: pinError };
    const accountId = text(formData, "accountId");
    const currency = text(formData, "currency").toUpperCase();
    const amountMinor = parseMoneyToMinor(text(formData, "amount"), currency);
    postAdjustment(getDb(), actor, {
      accountId,
      amountMinor,
      currency,
      reason: text(formData, "reason"),
    });
    revalidateOps("/ops/ledger", "/ops/audit", "/ops/health");
    return { ok: true, message: "Controlled adjustment posted as a new journal." };
  } catch (error) {
    return failure(error);
  }
}

/* -------------------------------------------------------------------------- */
/* Payout settlement                                                          */
/* -------------------------------------------------------------------------- */

export async function settlePayoutAction(
  _previous: OpsActionState,
  formData: FormData,
): Promise<OpsActionState> {
  try {
    const actor = await requireOps("ops:ledger");
    const pinError = await authorizePin(actor.id, text(formData, "pin"));
    if (pinError) return { error: pinError };
    settlePayoutByOps(getDb(), actor, text(formData, "transferId"));
    revalidateOps("/ops/integrations", "/ops/ledger", "/ops/audit");
    return { ok: true, message: "Simulated settlement posted and the hold was captured." };
  } catch (error) {
    return failure(error);
  }
}

/* -------------------------------------------------------------------------- */
/* Integrations                                                               */
/* -------------------------------------------------------------------------- */

export async function failPayoutAction(
  _previous: OpsActionState,
  formData: FormData,
): Promise<OpsActionState> {
  const actor = await requireOps("ops:ledger");
  try {
    const pinError = await authorizePin(actor.id, text(formData, "pin"));
    if (pinError) return { error: pinError };
    const transferId = text(formData, "transferId");
    failPayoutByOps(getDb(), actor, transferId, text(formData, "reason"));
    revalidateOps("/ops/integrations", "/ops/audit");
    revalidatePath("/app", "layout");
    return { ok: true, message: "Payout failed and held funds were released." };
  } catch (error) {
    return failure(error);
  }
}

export async function replayWebhookAction(
  _previous: OpsActionState,
  formData: FormData,
): Promise<OpsActionState> {
  try {
    const actor = await requireOps("dev:manage");
    replayWebhook(getDb(), actor, text(formData, "webhookId"));
    revalidateOps("/ops/integrations", "/ops/audit");
    return { ok: true, message: "Webhook delivery replayed." };
  } catch (error) {
    return failure(error);
  }
}
