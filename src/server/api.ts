import type Database from "better-sqlite3";
import { DomainError } from "@/domain/errors";
import { sha256 } from "@/lib/password";
import { rateLimit } from "@/lib/rate-limit";
import type { SessionUser } from "@/domain/identity";

export function authenticateApi(db: Database.Database, request: Request): SessionUser {
  const authorization = request.headers.get("authorization") ?? "";
  const match = /^Bearer (atlas_sk_sandbox_[A-Za-z0-9_-]+)$/.exec(authorization);
  if (!match) throw new DomainError("UNAUTHENTICATED", "A sandbox bearer key is required");
  const row = db.prepare(`SELECT u.id, u.email, u.name, u.initials, u.platform_role AS platformRole,
    u.kyc_status AS kycStatus, u.status, u.country, k.id AS keyId
    FROM api_keys k JOIN users u ON u.id = k.user_id
    WHERE k.key_hash = ? AND k.revoked_at IS NULL AND k.environment = 'sandbox' AND u.status = 'active'`).get(sha256(match[1])) as (Omit<SessionUser, "memberships"> & { keyId: string }) | undefined;
  if (!row) throw new DomainError("UNAUTHENTICATED", "Invalid or revoked sandbox key");
  if (!rateLimit(`api:${row.keyId}`, 120, 60_000).ok) throw new DomainError("RATE_LIMITED", "Sandbox API request limit reached");
  db.prepare("UPDATE api_keys SET last_used_at = ? WHERE id = ?").run(new Date().toISOString(), row.keyId);
  const { keyId: _, ...user } = row;
  return { ...user, memberships: [] };
}
