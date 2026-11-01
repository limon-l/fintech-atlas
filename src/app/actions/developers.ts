"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/db/client";
import { DomainError } from "@/domain/errors";
import { recordAudit, writeTransaction } from "@/domain/ledger";
import { createApiKey } from "@/server/ops";

export interface DeveloperActionState {
  ok?: boolean;
  error?: string;
  secret?: string;
  prefix?: string;
  message?: string;
}

export async function createApiKeyAction(
  _previous: DeveloperActionState,
  formData: FormData,
): Promise<DeveloperActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Your session has expired. Sign in again." };
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 3) return { error: "Give the key a descriptive name." };
  try {
    const result = createApiKey(getDb(), user, name);
    revalidatePath("/business/developers");
    revalidatePath("/ops/integrations");
    return {
      ok: true,
      secret: result.key,
      prefix: result.prefix,
      message: "API key created. Copy it now — it is shown only once.",
    };
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    if (error instanceof Error) return { error: error.message };
    return { error: "Could not create an API key." };
  }
}

export async function revokeApiKeyAction(
  _previous: DeveloperActionState,
  formData: FormData,
): Promise<DeveloperActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Your session has expired. Sign in again." };
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "Choose a key to revoke." };

  const db = getDb();
  const changed = writeTransaction(db, () => {
    const result = db
      .prepare("UPDATE api_keys SET revoked_at = ? WHERE id = ? AND user_id = ? AND revoked_at IS NULL")
      .run(new Date().toISOString(), id, user.id);
    if (!result.changes) return false;
    recordAudit(db, {
      actorId: user.id,
      actorRole: user.platformRole,
      action: "api_key.revoked",
      resourceType: "api_key",
      resourceId: id,
    });
    return true;
  });

  if (!changed) return { error: "That key was not found or is already revoked." };
  revalidatePath("/business/developers");
  return { ok: true, message: "API key revoked. Requests using it now fail." };
}
