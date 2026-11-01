import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getDb } from "@/db/client";
import { authenticateApi } from "@/server/api";
import { DomainError, errorResponse } from "@/domain/errors";
import { canBusiness, canPlatform } from "@/domain/rbac";
import { listAccounts, listTransactions } from "@/server/finance";
import { listTransfers } from "@/server/transfers";
import { getSystemHealth, listJournals } from "@/server/ops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ resource: string[] }> }) {
  const requestId = randomUUID();
  const headers = { "Cache-Control": "no-store", "X-Request-ID": requestId };
  try {
    const db = getDb();
    const user = authenticateApi(db, request);
    const { resource } = await context.params;
    const path = resource.join("/");
    const query = new URL(request.url).searchParams;
    const limit = z.coerce.number().int().min(1).max(100).parse(query.get("limit") ?? 25);
    const offset = z.coerce.number().int().min(0).max(100000).parse(query.get("offset") ?? 0);
    const orgId = query.get("org_id");
    let ownerType: "user" | "org" = "user";
    let ownerId = user.id;
    if (orgId) {
      const member = db.prepare("SELECT role FROM memberships WHERE user_id = ? AND org_id = ? AND status = 'active'").get(user.id, orgId) as { role: Parameters<typeof canBusiness>[0] } | undefined;
      if (!member || !canBusiness(member.role, "account:read")) throw new DomainError("FORBIDDEN", "Organization access denied");
      ownerType = "org"; ownerId = orgId;
    }
    let data: unknown;
    let total: number | undefined;
    if (path === "accounts") {
      const accounts = listAccounts(db, ownerType, ownerId);
      total = accounts.length;
      data = accounts.slice(offset, offset + limit).map(account => ({ id: account.id, name: account.name, currency: account.currency, status: account.status, balance_minor: account.ledgerMinor, held_minor: account.heldMinor, available_minor: account.availableMinor }));
    } else if (path === "transactions") {
      const result = listTransactions(db, ownerType, ownerId, { accountId: query.get("account_id") ?? undefined, limit, offset });
      data = result.rows; total = result.total;
    } else if (path === "transfers") {
      if (orgId || offset) throw new DomainError("VALIDATION_ERROR", "Transfers support personal scope and limit only");
      data = listTransfers(db, user.id, limit);
    } else if (path === "ledger/journals") {
      if (!canPlatform(user.platformRole, "ops:ledger")) throw new DomainError("FORBIDDEN", "Ledger permission required");
      data = listJournals(db, { limit });
    } else if (path === "health") {
      if (!canPlatform(user.platformRole, "ops:read")) throw new DomainError("FORBIDDEN", "Operations permission required");
      data = getSystemHealth(db);
    } else throw new DomainError("NOT_FOUND", "Unknown sandbox endpoint");
    return Response.json({ data, meta: { environment: "sandbox", request_id: requestId, limit, offset, total } }, { headers });
  } catch (error) {
    const response = errorResponse(error);
    return Response.json({ ...response.body, meta: { environment: "sandbox", request_id: requestId } }, { status: response.status, headers });
  }
}
