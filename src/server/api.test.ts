import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createDatabase, migrate } from "@/db/migrate";
import { seedDatabase } from "@/db/seed";
import { createApiKey } from "./ops";
import type { SessionUser } from "@/domain/identity";
const state = vi.hoisted(() => ({ db: null as ReturnType<typeof createDatabase> | null }));
vi.mock("@/db/client", () => ({ getDb: () => state.db }));
import { GET } from "@/app/api/v1/[...resource]/route";

beforeEach(() => { state.db = createDatabase(":memory:"); migrate(state.db); seedDatabase(state.db); });
afterEach(() => state.db!.close());
const actor: SessionUser = { id: "usr_jonas", email: "jonas@atlas.demo", name: "Jonas", initials: "JR", platformRole: "customer", status: "active", kycStatus: "verified", country: "GB", memberships: [] };
async function call(path: string, key?: string, query = "") {
  return GET(new Request(`http://localhost/api/v1/${path}${query}`, { headers: key ? { authorization: `Bearer ${key}` } : {} }), { params: Promise.resolve({ resource: path.split("/") }) });
}
it("returns structured 401 responses without leaking data", async () => {
  const response = await call("accounts");
  expect(response.status).toBe(401);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect((await response.json()).error.code).toBe("UNAUTHENTICATED");
});
it("checks ownership and staff permissions at the HTTP boundary", async () => {
  const key = createApiKey(state.db!, actor, "integration").key;
  const response = await call("accounts", key);
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.meta.environment).toBe("sandbox");
  expect(body.data.every((row: { id: string }) => !row.id.startsWith("acc_maya"))).toBe(true);
  expect((await call("ledger/journals", key)).status).toBe(403);
  expect((await call("accounts", key, "?org_id=not-a-member")).status).toBe(403);
  expect((await call("accounts", key, "?limit=1000")).status).toBe(422);
});
it("revocation immediately blocks API access", async () => {
  const key = createApiKey(state.db!, actor, "revoked");
  state.db!.prepare("UPDATE api_keys SET revoked_at = ? WHERE id = ?").run(new Date().toISOString(), key.id);
  expect((await call("accounts", key.key)).status).toBe(401);
});
