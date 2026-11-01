"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/db/client";
import { DomainError } from "@/domain/errors";
import { parseMoneyToMinor } from "@/domain/money";
import {
  contributeToGoal,
  createSupportTicket,
  markAllNotificationsRead,
  markNotificationRead,
  updateBudgetCategory,
  updateCardControls,
  updateProfile,
} from "@/server/personal";

export interface ActionState {
  ok?: boolean;
  error?: string;
  message?: string;
}

function failure(error: unknown): ActionState {
  if (error instanceof DomainError) return { error: error.message };
  if (error instanceof Error) return { error: error.message };
  return { error: "Something went wrong. Please try again." };
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  markAllNotificationsRead(getDb(), user.id);
  revalidatePath("/", "layout");
}

export async function markNotificationReadAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const id = String(formData.get("id") ?? "");
  if (id) markNotificationRead(getDb(), user.id, id);
  revalidatePath("/", "layout");
}

export async function updateCardAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Your session has expired. Sign in again." };
  const db = getDb();
  const cardId = String(formData.get("cardId") ?? "");
  const intent = String(formData.get("intent") ?? "limits");
  try {
    if (intent === "freeze" || intent === "unfreeze") {
      updateCardControls(db, user, { cardId, status: intent === "freeze" ? "frozen" : "active" });
      revalidatePath("/app/cards");
      revalidatePath("/business/cards");
      return { ok: true, message: intent === "freeze" ? "Card frozen." : "Card unfrozen." };
    }
    const card = db.prepare("SELECT currency FROM cards WHERE id = ?").get(cardId) as { currency: string } | undefined;
    if (!card) return { error: "Card not found." };
    const monthly = String(formData.get("monthlyLimit") ?? "").trim();
    const perTxn = String(formData.get("perTxnLimit") ?? "").trim();
    if (!monthly || !perTxn) return { error: "Enter both card limits." };
    updateCardControls(db, user, {
      cardId,
      monthlyLimitMinor: parseMoneyToMinor(monthly, card.currency),
      perTxnLimitMinor: parseMoneyToMinor(perTxn, card.currency),
    });
    revalidatePath("/app/cards");
    revalidatePath("/business/cards");
    return { ok: true, message: "Card limits updated." };
  } catch (error) {
    return failure(error);
  }
}

export async function updateBudgetAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Your session has expired. Sign in again." };
  const db = getDb();
  const categoryId = String(formData.get("categoryId") ?? "");
  const raw = String(formData.get("limit") ?? "");
  try {
    const row = db
      .prepare(
        `SELECT b.currency FROM budget_categories bc JOIN budgets b ON b.id = bc.budget_id
         WHERE bc.id = ? AND b.user_id = ?`,
      )
      .get(categoryId, user.id) as { currency: string } | undefined;
    if (!row) return { error: "Budget category not found." };
    updateBudgetCategory(db, user.id, {
      categoryId,
      limitMinor: parseMoneyToMinor(raw, row.currency),
    });
    revalidatePath("/app/budgets");
    return { ok: true, message: "Budget updated." };
  } catch (error) {
    return failure(error);
  }
}

export async function contributeGoalAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Your session has expired. Sign in again." };
  const db = getDb();
  const goalId = String(formData.get("goalId") ?? "");
  const sourceAccountId = String(formData.get("sourceAccountId") ?? "");
  const raw = String(formData.get("amount") ?? "");
  try {
    const account = db
      .prepare("SELECT currency FROM accounts WHERE id = ? AND owner_type = 'user' AND owner_id = ?")
      .get(sourceAccountId, user.id) as { currency: string } | undefined;
    if (!account) return { error: "Funding account not found." };
    const result = contributeToGoal(db, user, {
      goalId,
      sourceAccountId,
      amountMinor: parseMoneyToMinor(raw, account.currency),
    });
    revalidatePath("/app/goals");
    revalidatePath("/app");
    return { ok: true, message: `Contribution posted · ${result.reference}` };
  } catch (error) {
    return failure(error);
  }
}

export async function updateProfileAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Your session has expired. Sign in again." };
  try {
    updateProfile(getDb(), user, {
      name: String(formData.get("name") ?? ""),
      country: String(formData.get("country") ?? ""),
      timezone: String(formData.get("timezone") ?? "Europe/London"),
    });
    revalidatePath("/app/settings");
    revalidatePath("/", "layout");
    return { ok: true, message: "Profile updated." };
  } catch (error) {
    return failure(error);
  }
}

export async function createSupportTicketAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Your session has expired. Sign in again." };
  try {
    const id = createSupportTicket(getDb(), user, {
      subject: String(formData.get("subject") ?? ""),
      priority: (String(formData.get("priority") ?? "normal") as "low" | "normal" | "high") ?? "normal",
    });
    revalidatePath("/app/settings");
    revalidatePath("/ops/support");
    return { ok: true, message: `Support request ${id} created.` };
  } catch (error) {
    return failure(error);
  }
}
