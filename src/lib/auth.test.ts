import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type Database from "better-sqlite3";
import { createDatabase, migrate } from "@/db/migrate";
import { seedDatabase } from "@/db/seed";
import { sha256 } from "./password";
import { resetRateLimits } from "./rate-limit";

const context = vi.hoisted(() => ({
  db: null as Database.Database | null,
  values: new Map<string, string>(),
  set: vi.fn(),
}));
vi.mock("@/db/client", () => ({ getDb: () => context.db }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "user-agent": "atlas-auth-test" }),
  cookies: async () => ({
    get: (name: string) => context.values.has(name) ? { value: context.values.get(name) } : undefined,
    set: (name: string, value: string, options: unknown) => {
      context.values.set(name, value);
      context.set(name, value, options);
    },
    delete: (name: string) => context.values.delete(name),
  }),
}));
import { getCurrentUser, ORG_COOKIE, SESSION_COOKIE, signIn, signOut, verifyPin } from "./auth";

let db: Database.Database;
beforeEach(() => {
  db = createDatabase(":memory:");
  migrate(db);
  seedDatabase(db);
  context.db = db;
  context.values.clear();
  context.set.mockClear();
  resetRateLimits();
});
afterEach(() => db.close());

describe("authentication lifecycle", () => {
  it("normalizes login, hashes session tokens and revokes them on logout", async () => {
    expect(await signIn(" MAYA@ATLAS.DEMO ", "atlas-demo-2026")).toEqual({ ok: true });
    const token = context.values.get(SESSION_COOKIE)!;
    const session = db.prepare("SELECT token_hash FROM sessions WHERE token_hash = ?").get(sha256(token)) as { token_hash: string };
    expect(session.token_hash).not.toBe(token);
    expect(context.set).toHaveBeenCalledWith(SESSION_COOKIE, token, expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/" }));
    expect((await getCurrentUser())?.id).toBe("usr_maya");
    context.values.set(ORG_COOKIE, "org_northwind");
    await signOut();
    expect(context.values.has(SESSION_COOKIE)).toBe(false);
    expect(context.values.has(ORG_COOKIE)).toBe(false);
    context.values.set(SESSION_COOKIE, token);
    expect(await getCurrentUser()).toBeNull();
  });

  it("rejects wrong credentials and suspended users without creating sessions", async () => {
    expect((await signIn("maya@atlas.demo", "wrong")).ok).toBe(false);
    expect((await signIn("missing@atlas.demo", "atlas-demo-2026")).ok).toBe(false);
    db.prepare("UPDATE users SET status = 'suspended' WHERE id = 'usr_maya'").run();
    expect((await signIn("maya@atlas.demo", "atlas-demo-2026")).ok).toBe(false);
    expect(context.values.has(SESSION_COOKIE)).toBe(false);
  });

  it("rejects expired sessions and suspended users with an existing token", async () => {
    await signIn("maya@atlas.demo", "atlas-demo-2026");
    db.prepare("UPDATE sessions SET expires_at = '2000-01-01T00:00:00.000Z'").run();
    expect(await getCurrentUser()).toBeNull();
    await signIn("maya@atlas.demo", "atlas-demo-2026");
    db.prepare("UPDATE users SET status = 'suspended' WHERE id = 'usr_maya'").run();
    expect(await getCurrentUser()).toBeNull();
  });

  it("checks the PIN and rate limits repeated authorization attempts", async () => {
    expect(await verifyPin("usr_maya", "246810")).toBe(true);
    for (let attempt = 0; attempt < 4; attempt++) expect(await verifyPin("usr_maya", "000000")).toBe(false);
    await expect(verifyPin("usr_maya", "246810")).rejects.toThrow(/Too many/);
  });
});
