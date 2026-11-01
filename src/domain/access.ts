import type Database from "better-sqlite3";
import { DomainError } from "./errors";
import { canBusiness, type BusinessRole, type Permission } from "./rbac";
import type { SessionUser } from "./identity";

export function assertBusinessPermission(role: BusinessRole, permission: Permission): void {
  if (!canBusiness(role, permission)) {
    throw new DomainError("FORBIDDEN", "Your role does not permit this action");
  }
}

/**
 * Resource-level authorization. Ownership is resolved from the database, never
 * from client-supplied identifiers. Organization roles are checked with ABAC.
 */
export function assertAccountAccess(
  db: Database.Database,
  user: SessionUser,
  accountId: string,
  permission: Permission = "account:read",
): { id: string; owner_type: string; owner_id: string; currency: string; status: string; name: string } {
  const account = db
    .prepare("SELECT id, owner_type, owner_id, currency, status, name FROM accounts WHERE id = ?")
    .get(accountId) as
    | {
        id: string;
        owner_type: string;
        owner_id: string;
        currency: string;
        status: string;
        name: string;
      }
    | undefined;
  if (!account) throw new DomainError("NOT_FOUND", "Account not found");

  if (account.owner_type === "user") {
    if (account.owner_id !== user.id) throw new DomainError("FORBIDDEN", "Account access denied");
    return account;
  }

  if (account.owner_type === "org") {
    const membership = db
      .prepare("SELECT role FROM memberships WHERE org_id = ? AND user_id = ? AND status = 'active'")
      .get(account.owner_id, user.id) as { role: BusinessRole } | undefined;
    if (!membership) throw new DomainError("FORBIDDEN", "Organization access denied");
    if (!canBusiness(membership.role, permission)) {
      throw new DomainError("FORBIDDEN", "Your organization role does not permit this action");
    }
    return account;
  }

  throw new DomainError("FORBIDDEN", "Unknown account ownership");
}
