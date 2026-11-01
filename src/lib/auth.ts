import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type Database from "better-sqlite3";
import { getDb } from "@/db/client";
import { DomainError } from "@/domain/errors";
import { canBusiness, canPlatform, type BusinessRole, type Permission, type PlatformRole } from "@/domain/rbac";
import type { Membership, SessionUser } from "@/domain/identity";
import { recordAudit, writeTransaction } from "@/domain/ledger";
import { randomToken, sha256, verifySecret } from "./password";
import { rateLimit } from "./rate-limit";
import { DEMO_PASSWORD } from "@/lib/demo";

export const SESSION_COOKIE = "atlas_session";
export const ORG_COOKIE = "atlas_org";
const SESSION_HOURS = 8;

export type { Membership, SessionUser } from "@/domain/identity";

interface UserRow {
  id: string;
  email: string;
  name: string;
  initials: string;
  platform_role: PlatformRole;
  kyc_status: string;
  status: string;
  country: string;
}

function membershipsFor(db: Database.Database, userId: string): Membership[] {
  return (
    db
      .prepare(
        `SELECT m.org_id AS orgId, o.name AS orgName, o.slug AS orgSlug, m.role
         FROM memberships m
         JOIN organizations o ON o.id = m.org_id
         WHERE m.user_id = ? AND m.status = 'active'
         ORDER BY m.created_at ASC`,
      )
      .all(userId) as Membership[]
  );
}

export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const db = getDb();
  const row = db
    .prepare(
      `SELECT u.id, u.email, u.name, u.initials, u.platform_role, u.kyc_status, u.status, u.country
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > ?
       LIMIT 1`,
    )
    .get(sha256(token), new Date().toISOString()) as UserRow | undefined;
  if (!row || row.status !== "active") return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    initials: row.initials,
    platformRole: row.platform_role,
    kycStatus: row.kyc_status,
    status: row.status,
    country: row.country,
    memberships: membershipsFor(db, row.id),
  };
});

export async function requireUser(nextPath = "/app"): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return user;
}

export async function requireOps(permission: Permission = "ops:read"): Promise<SessionUser> {
  const user = await requireUser("/ops");
  if (!canPlatform(user.platformRole, permission)) {
    redirect("/app?denied=ops");
  }
  return user;
}

export interface BusinessContext {
  user: SessionUser;
  orgId: string;
  orgName: string;
  orgSlug: string;
  role: BusinessRole;
  baseCurrency: string;
}

export async function getBusinessContext(): Promise<BusinessContext | null> {
  const user = await getCurrentUser();
  if (!user || user.memberships.length === 0) return null;
  const store = await cookies();
  const selected = store.get(ORG_COOKIE)?.value;
  const membership = user.memberships.find((m) => m.orgId === selected) ?? user.memberships[0]!;
  const org = getDb()
    .prepare("SELECT base_currency FROM organizations WHERE id = ?")
    .get(membership.orgId) as { base_currency: string } | undefined;
  return {
    user,
    orgId: membership.orgId,
    orgName: membership.orgName,
    orgSlug: membership.orgSlug,
    role: membership.role,
    baseCurrency: org?.base_currency ?? "USD",
  };
}

export async function requireBusiness(permission?: Permission): Promise<BusinessContext> {
  await requireUser("/business");
  const ctx = await getBusinessContext();
  if (!ctx) redirect("/app?denied=business");
  if (permission && !canBusiness(ctx.role, permission)) {
    redirect("/business?denied=permission");
  }
  return ctx;
}

export async function verifyPin(userId: string, pin: string): Promise<boolean> {
  const db = getDb();
  const row = db.prepare("SELECT pin_hash FROM users WHERE id = ?").get(userId) as
    | { pin_hash: string }
    | undefined;
  if (!row) return false;
  const limit = rateLimit(`pin:${userId}`, 5, 5 * 60_000);
  if (!limit.ok) throw new DomainError("RATE_LIMITED", "Too many authorization attempts. Try again shortly.");
  return verifySecret(pin, row.pin_hash);
}

export async function signIn(
  email: string,
  password: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const db = getDb();
  const normalized = email.trim().toLowerCase();
  const requestHeaders = await headers();
  const ip = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const userAgent = (requestHeaders.get("user-agent") ?? "").slice(0, 300);
  const ipLimit = rateLimit(`login:ip:${ip}`, 20, 10 * 60_000);
  if (!ipLimit.ok) return { ok: false, message: "Too many attempts. Please wait and try again." };
  const emailLimit = rateLimit(`login:email:${normalized}`, 8, 10 * 60_000);
  if (!emailLimit.ok) return { ok: false, message: "Too many attempts for this account." };

  const user = db
    .prepare("SELECT id, password_hash, status, platform_role FROM users WHERE email = ?")
    .get(normalized) as
    | { id: string; password_hash: string; status: string; platform_role: string }
    | undefined;

  if (!user || !verifySecret(password, user.password_hash)) {
    recordAudit(db, {
      action: "auth.login_failed",
      resourceType: "user",
      metadata: { email: normalized, ip },
      ip,
    });
    return { ok: false, message: "Email or password is incorrect." };
  }
  if (user.status !== "active") {
    return { ok: false, message: "This account is suspended. Contact support." };
  }

  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 3_600_000).toISOString();
  const sessionId = `ses_${randomToken(12)}`;
  writeTransaction(db, () => {
    db.prepare(
      `INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at, ip, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      sessionId,
      user.id,
      sha256(token),
      new Date().toISOString(),
      expiresAt,
      ip,
      userAgent,
    );
    db.prepare("UPDATE users SET last_login_at = ? WHERE id = ?").run(new Date().toISOString(), user.id);
    recordAudit(db, {
      actorId: user.id,
      actorRole: user.platform_role,
      action: "auth.login_succeeded",
      resourceType: "session",
      resourceId: sessionId,
      ip,
    });
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
  return { ok: true };
}

export async function signInDemo(email: string): Promise<{ ok: boolean; message?: string }> {
  return signIn(email, DEMO_PASSWORD);
}

export async function signOut(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    const db = getDb();
    db.prepare("UPDATE sessions SET revoked_at = ? WHERE token_hash = ?").run(
      new Date().toISOString(),
      sha256(token),
    );
  }
  store.delete(SESSION_COOKIE);
}

export async function setActiveOrg(orgId: string): Promise<void> {
  const user = await requireUser();
  if (!user.memberships.some((m) => m.orgId === orgId)) {
    throw new DomainError("FORBIDDEN", "You are not a member of this organization");
  }
  const store = await cookies();
  store.set(ORG_COOKIE, orgId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 30 * 24 * 3600,
  });
}

export function isPlatformStaff(user: SessionUser): boolean {
  return user.platformRole !== "customer";
}

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) return;
  const host = request.headers.get("host");
  try {
    const originHost = new URL(origin).host;
    if (!host || originHost !== host) {
      throw new DomainError("FORBIDDEN", "Cross-origin request rejected");
    }
  } catch (error) {
    if (error instanceof DomainError) throw error;
    throw new DomainError("FORBIDDEN", "Invalid origin");
  }
}
