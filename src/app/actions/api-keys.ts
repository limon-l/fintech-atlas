"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/db/client";
import { createApiKey } from "@/server/ops";
import { recordAudit, writeTransaction } from "@/domain/ledger";
import { errorResponse } from "@/domain/errors";

export async function issueKey(_: { key: string; error: string }, data: FormData) {
  const user = await requireUser();
  try {
    const name = z.string().trim().min(1).max(80).parse(data.get("name"));
    const result = createApiKey(getDb(), user, name);
    revalidatePath("/business/developers");
    return { key: result.key, error: "" };
  } catch (error) { return { key: "", error: errorResponse(error).body.error.message }; }
}

export async function revokeKey(data: FormData) {
  const user = await requireUser();
  const id = z.string().min(1).parse(data.get("id"));
  const db = getDb();
  writeTransaction(db, () => {
    const result = db.prepare("UPDATE api_keys SET revoked_at = ? WHERE id = ? AND user_id = ? AND revoked_at IS NULL").run(new Date().toISOString(), id, user.id);
    if (result.changes) recordAudit(db, { actorId: user.id, actorRole: user.platformRole, action: "api_key.revoked", resourceType: "api_key", resourceId: id });
  });
  revalidatePath("/business/developers");
}
