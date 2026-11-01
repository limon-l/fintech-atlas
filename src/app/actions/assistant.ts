"use server";

import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/db/client";
import { askAtlas, type AssistantAnswer } from "@/server/assistant";

export async function askAtlasAction(question: string): Promise<{ ok: boolean; answer?: AssistantAnswer; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Your session has expired. Sign in again." };
  const trimmed = question.trim();
  if (trimmed.length < 3) return { ok: false, error: "Ask a slightly longer question." };
  if (trimmed.length > 300) return { ok: false, error: "Keep the question under 300 characters." };
  try {
    return { ok: true, answer: askAtlas(getDb(), user, trimmed) };
  } catch {
    return { ok: false, error: "The assistant could not answer from your records." };
  }
}
