"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, verifyPin } from "@/lib/auth";
import { getDb } from "@/db/client";
import { DomainError } from "@/domain/errors";
import { parseMoneyToMinor } from "@/domain/money";
import { sha256 } from "@/lib/password";
import { createQuote, createTransfer, type CreateQuoteResult } from "@/server/transfers";

export interface ActionResult<T = undefined> {
  ok: boolean;
  error?: string;
  data?: T;
}

function failure<T>(error: unknown): ActionResult<T> {
  if (error instanceof DomainError) return { ok: false, error: error.message };
  if (error instanceof Error) return { ok: false, error: error.message };
  return { ok: false, error: "Something went wrong. Please try again." };
}

export interface QuoteRequest {
  sourceAccountId: string;
  targetCurrency: string;
  amount: string;
}

export async function requestQuoteAction(input: QuoteRequest): Promise<ActionResult<CreateQuoteResult>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Your session has expired. Sign in again." };
  try {
    const db = getDb();
    const account = db
      .prepare("SELECT currency FROM accounts WHERE id = ? AND owner_type = 'user' AND owner_id = ?")
      .get(input.sourceAccountId, user.id) as { currency: string } | undefined;
    if (!account) return { ok: false, error: "Choose a funding account." };
    const amountMinor = parseMoneyToMinor(input.amount, account.currency);
    const quote = createQuote(db, user, input.sourceAccountId, input.targetCurrency, amountMinor);
    revalidatePath("/app/fx");
    return { ok: true, data: quote };
  } catch (error) {
    return failure(error);
  }
}

export interface TransferRequest {
  direction: "internal" | "external" | "fx";
  sourceAccountId: string;
  amount: string;
  destinationAccountId?: string;
  beneficiaryId?: string;
  targetCurrency?: string;
  quoteId?: string;
  note?: string;
  pin: string;
  idempotencyKey: string;
}

export interface TransferOutcome {
  transferId: string;
  reference: string;
  status: string;
}

export async function submitTransferAction(input: TransferRequest): Promise<ActionResult<TransferOutcome>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Your session has expired. Sign in again." };
  try {
    const db = getDb();
    const source = db
      .prepare("SELECT currency, status FROM accounts WHERE id = ? AND owner_type = 'user' AND owner_id = ?")
      .get(input.sourceAccountId, user.id) as { currency: string; status: string } | undefined;
    if (!source) return { ok: false, error: "Choose a funding account." };
    const amountMinor = parseMoneyToMinor(input.amount, source.currency);
    if (!(await verifyPin(user.id, input.pin))) {
      return { ok: false, error: "That authorization PIN is incorrect." };
    }
    const idempotencyKey = input.idempotencyKey.trim();
    if (idempotencyKey.length < 8) {
      return { ok: false, error: "Refresh the form and try again." };
    }
    const requestHash = sha256(
      JSON.stringify({
        direction: input.direction,
        sourceAccountId: input.sourceAccountId,
        amountMinor,
        destinationAccountId: input.destinationAccountId ?? null,
        beneficiaryId: input.beneficiaryId ?? null,
        targetCurrency: input.targetCurrency ?? null,
        quoteId: input.quoteId ?? null,
        note: input.note?.trim() || null,
      }),
    );
    const result = createTransfer(db, {
      user,
      sourceAccountId: input.sourceAccountId,
      direction: input.direction,
      amountMinor,
      destinationAccountId: input.destinationAccountId,
      beneficiaryId: input.beneficiaryId,
      targetCurrency: input.targetCurrency,
      quoteId: input.quoteId,
      note: input.note,
      idempotencyKey,
      requestHash,
      pinVerified: true,
    });
    revalidatePath("/app");
    revalidatePath("/app/accounts");
    revalidatePath("/app/transactions");
    revalidatePath("/app/transfers");
    revalidatePath("/app/fx");
    return {
      ok: true,
      data: { transferId: result.transferId, reference: result.reference, status: result.status },
    };
  } catch (error) {
    return failure(error);
  }
}

export async function createBeneficiaryAction(input: {
  name: string;
  type: "bank" | "wallet" | "internal";
  email?: string;
  bankName?: string;
  accountMasked: string;
  ibanMasked?: string;
  currency: string;
  country: string;
}): Promise<ActionResult<{ id: string }>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Your session has expired. Sign in again." };
  try {
    const { createBeneficiary } = await import("@/server/transfers");
    const id = createBeneficiary(getDb(), user, input);
    revalidatePath("/app/beneficiaries");
    revalidatePath("/app/transfers/new");
    return { ok: true, data: { id } };
  } catch (error) {
    return failure(error);
  }
}
