import type { SessionUser } from "@/domain/identity";

export function homeFor(user: SessionUser): string {
  if (user.platformRole !== "customer") return "/ops";
  if (user.memberships.length > 0) return "/business";
  return "/app";
}

export function safeNext(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}
