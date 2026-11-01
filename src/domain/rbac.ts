export type PlatformRole =
  | "customer"
  | "support"
  | "risk"
  | "compliance"
  | "admin"
  | "super_admin";

export type BusinessRole = "owner" | "finance_manager" | "approver" | "employee";

export type Permission =
  | "account:read"
  | "account:transfer"
  | "account:manage"
  | "card:read"
  | "card:control"
  | "budget:manage"
  | "goal:manage"
  | "invoice:read"
  | "invoice:write"
  | "invoice:send"
  | "expense:submit"
  | "expense:read_all"
  | "expense:approve"
  | "bill:read"
  | "bill:write"
  | "bill:approve"
  | "bill:pay"
  | "approval:read"
  | "approval:decide"
  | "report:read"
  | "team:manage"
  | "org:manage"
  | "ops:read"
  | "ops:risk"
  | "ops:compliance"
  | "ops:reconcile"
  | "ops:ledger"
  | "ops:admin"
  | "dev:manage"
  | "audit:read";

const BUSINESS_PERMISSIONS: Record<BusinessRole, Permission[]> = {
  owner: [
    "account:read",
    "account:transfer",
    "account:manage",
    "card:read",
    "card:control",
    "invoice:read",
    "invoice:write",
    "invoice:send",
    "expense:submit",
    "expense:read_all",
    "expense:approve",
    "bill:read",
    "bill:write",
    "bill:approve",
    "bill:pay",
    "approval:read",
    "approval:decide",
    "report:read",
    "team:manage",
    "org:manage",
    "dev:manage",
    "audit:read",
  ],
  finance_manager: [
    "account:read",
    "account:transfer",
    "card:read",
    "card:control",
    "invoice:read",
    "invoice:write",
    "invoice:send",
    "expense:submit",
    "expense:read_all",
    "expense:approve",
    "bill:read",
    "bill:write",
    "bill:approve",
    "bill:pay",
    "approval:read",
    "approval:decide",
    "report:read",
    "audit:read",
  ],
  approver: [
    "account:read",
    "card:read",
    "invoice:read",
    "expense:submit",
    "expense:read_all",
    "bill:read",
    "approval:read",
    "approval:decide",
    "report:read",
  ],
  employee: ["account:read", "card:read", "expense:submit", "invoice:read"],
};

const PLATFORM_PERMISSIONS: Record<PlatformRole, Permission[]> = {
  customer: [],
  support: ["ops:read", "audit:read"],
  risk: ["ops:read", "ops:risk", "audit:read", "report:read"],
  compliance: ["ops:read", "ops:compliance", "audit:read", "report:read"],
  admin: ["ops:read", "ops:reconcile", "ops:ledger", "ops:admin", "audit:read", "dev:manage"],
  super_admin: [
    "ops:read",
    "ops:risk",
    "ops:compliance",
    "ops:reconcile",
    "ops:ledger",
    "ops:admin",
    "audit:read",
    "dev:manage",
    "report:read",
  ],
};

export function businessPermissions(role: BusinessRole): Permission[] {
  return BUSINESS_PERMISSIONS[role] ?? [];
}

export function platformPermissions(role: PlatformRole): Permission[] {
  return PLATFORM_PERMISSIONS[role] ?? [];
}

export function canBusiness(role: BusinessRole, permission: Permission): boolean {
  return businessPermissions(role).includes(permission);
}

export function canPlatform(role: PlatformRole, permission: Permission): boolean {
  return platformPermissions(role).includes(permission);
}

/** Platform staff are never granted implicit customer fund-movement authority. */
export function canMoveCustomerFunds(platformRole: PlatformRole): boolean {
  return platformRole === "customer";
}

export const OPS_ROLES: PlatformRole[] = [
  "support",
  "risk",
  "compliance",
  "admin",
  "super_admin",
];

export const ROLE_LABELS: Record<PlatformRole | BusinessRole, string> = {
  customer: "Personal customer",
  support: "Support agent",
  risk: "Risk analyst",
  compliance: "Compliance officer",
  admin: "System admin",
  super_admin: "Super admin",
  owner: "Business owner",
  finance_manager: "Finance manager",
  approver: "Approver",
  employee: "Employee",
};
