import Database from "better-sqlite3";
import { createHash, randomBytes } from "node:crypto";

const BASE = process.env.AUDIT_BASE ?? "http://localhost:3211";
const DB_PATH = process.env.DATABASE_PATH ?? "./data/atlas.db";
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

const db = new Database(DB_PATH);
db.pragma("busy_timeout = 8000");

const personas = {
  maya: "usr_maya",
  jonas: "usr_jonas",
  priya: "usr_priya",
  leo: "usr_leo",
  sam: "usr_sam",
  nadia: "usr_nadia",
  owen: "usr_owen",
  elena: "usr_elena",
  admin: "usr_admin",
};

const tokens = {};
const createdSessions = [];
for (const [name, userId] of Object.entries(personas)) {
  const token = `audit_${name}_${randomBytes(6).toString("hex")}`;
  tokens[name] = token;
  const id = `ses_audit_${name}`;
  db.prepare("DELETE FROM sessions WHERE id = ?").run(id);
  db.prepare(
    `INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at, ip, user_agent)
     VALUES (?, ?, ?, ?, ?, 'audit', 'audit')`,
  ).run(id, userId, sha256(token), new Date().toISOString(), new Date(Date.now() + 3600_000).toISOString());
  createdSessions.push(id);
}

const adminKey = `atlas_sk_sandbox_audit_admin_${randomBytes(6).toString("hex")}`;
const jonasKey = "atlas_sk_sandbox_demo_7f3c9a2e5b814d06";
db.prepare("DELETE FROM api_keys WHERE id = 'key_audit_admin'").run();
db.prepare(
  `INSERT INTO api_keys (id, user_id, name, prefix, key_hash, environment, last_used_at, created_at, revoked_at)
   VALUES ('key_audit_admin', 'usr_admin', 'Audit key', 'atlas_sk_sandbox_audit', ?, 'sandbox', NULL, ?, NULL)`,
).run(sha256(adminKey), new Date().toISOString());

const first = (sql, ...args) => db.prepare(sql).get(...args);
const mayaTxn = first(
  "SELECT t.id FROM transactions t JOIN accounts a ON a.id = t.account_id WHERE a.owner_id = 'usr_maya' ORDER BY t.created_at DESC LIMIT 1",
).id;
const invoice = first("SELECT id FROM invoices ORDER BY created_at DESC LIMIT 1").id;
const approval = first("SELECT id FROM approval_requests LIMIT 1").id;
const journal = first("SELECT id FROM journal_entries ORDER BY created_at DESC LIMIT 1").id;

const publicRoutes = [
  "/", "/pricing", "/security", "/developers", "/login", "/docs",
  "/docs/blueprint", "/docs/architecture", "/docs/ledger", "/docs/rbac",
  "/docs/design", "/docs/implementation", "/docs/qa", "/docs/backlog", "/docs/portfolio",
  "/docs/not-a-real-doc",
];

const protectedRoutes = [
  ["maya", "/app"],
  ["maya", "/app/accounts"],
  ["maya", "/app/accounts/acc_maya_usd"],
  ["maya", "/app/transactions"],
  ["maya", `/app/transactions/${mayaTxn}`],
  ["maya", "/app/transfers"],
  ["maya", "/app/transfers/new"],
  ["maya", "/app/transfers/trf_maya_gbp_pending"],
  ["maya", "/app/fx"],
  ["maya", "/app/cards"],
  ["maya", "/app/budgets"],
  ["maya", "/app/goals"],
  ["maya", "/app/bills"],
  ["maya", "/app/insights"],
  ["maya", "/app/beneficiaries"],
  ["maya", "/app/settings"],
  ["jonas", "/business"],
  ["jonas", "/business/invoices"],
  ["jonas", `/business/invoices/${invoice}`],
  ["jonas", "/business/bills"],
  ["jonas", "/business/vendors"],
  ["jonas", "/business/approvals"],
  ["jonas", `/business/approvals/${approval}`],
  ["jonas", "/business/expenses"],
  ["jonas", "/business/cards"],
  ["jonas", "/business/team"],
  ["jonas", "/business/reports"],
  ["jonas", "/business/developers"],
  ["admin", "/ops"],
  ["admin", "/ops/customers"],
  ["admin", "/ops/customers/usr_maya"],
  ["admin", "/ops/support"],
  ["admin", "/ops/risk"],
  ["admin", "/ops/compliance"],
  ["admin", "/ops/reconciliation"],
  ["admin", "/ops/ledger"],
  ["admin", `/ops/ledger/${journal}`],
  ["admin", "/ops/audit"],
  ["admin", "/ops/integrations"],
  ["admin", "/ops/health"],
  ["admin", "/ops/permissions"],
];

const apiRoutes = [
  ["no-key", "/api/v1/accounts", null, 401],
  ["jonas", "/api/v1/accounts", jonasKey, 200],
  ["jonas", "/api/v1/accounts?org_id=org_northwind", jonasKey, 200],
  ["jonas", "/api/v1/transactions?limit=5", jonasKey, 200],
  ["jonas", "/api/v1/transfers?limit=5", jonasKey, 200],
  ["jonas", "/api/v1/ledger/journals", jonasKey, 403],
  ["jonas", "/api/v1/health", jonasKey, 403],
  ["jonas", "/api/v1/accounts?limit=999", jonasKey, 422],
  ["admin", "/api/v1/ledger/journals?limit=5", adminKey, 200],
  ["admin", "/api/v1/health", adminKey, 200],
  ["admin", "/api/v1/nope", adminKey, 404],
];

const results = [];
async function probe(path, token, expected, auth = "cookie") {
  const headers = token
    ? auth === "cookie"
      ? { cookie: `atlas_session=${token}` }
      : { authorization: `Bearer ${token}` }
    : {};
  const response = await fetch(BASE + path, { headers, redirect: "manual" });
  const status = response.status;
  const location = response.headers.get("location");
  const ok = expected === undefined ? status >= 200 && status < 400 : status === expected;
  results.push({ path, status, expected: expected ?? "2xx/3xx", ok, location });
  return response;
}

for (const path of publicRoutes) {
  const expected = path.includes("not-a-real-doc") ? 404 : 200;
  await probe(path, null, expected);
}

for (const [persona, path] of protectedRoutes) {
  await probe(path, tokens[persona], 200);
}

for (const path of ["/app", "/business", "/ops"]) {
  await probe(path, null, 307);
}

for (const [, path, key, expected] of apiRoutes) {
  await probe(path, key, expected, "bearer");
}

// Crawl internal links from public pages and report any that 404.
const publicHtml = await Promise.all(
  ["/", "/pricing", "/security", "/developers", "/docs"].map(async (path) => ({
    path,
    html: await (await fetch(BASE + path)).text(),
  })),
);
const links = new Set();
for (const { html } of publicHtml) {
  for (const match of html.matchAll(/href="(\/[^"#?]*)/g)) links.add(match[1]);
}
for (const link of [...links].sort()) {
  if (link.startsWith("/_next") || link.startsWith("/api")) continue;
  const response = await fetch(BASE + link, { redirect: "manual" });
  results.push({
    path: `link ${link}`,
    status: response.status,
    expected: "2xx/3xx",
    ok: response.status >= 200 && response.status < 400,
    location: response.headers.get("location"),
  });
}

const failures = results.filter((r) => !r.ok);
for (const row of results) {
  console.log(
    `${row.ok ? "PASS" : "FAIL"}  ${String(row.status).padEnd(3)} ${row.expected.toString().padEnd(7)} ${row.path}${row.location ? ` -> ${row.location}` : ""}`,
  );
}
console.log(`\n${results.length - failures.length}/${results.length} checks passed`);

for (const id of createdSessions) db.prepare("DELETE FROM sessions WHERE id = ?").run(id);
db.prepare("DELETE FROM api_keys WHERE id = 'key_audit_admin'").run();
db.close();

process.exit(failures.length ? 1 : 0);
