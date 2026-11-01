import type { BusinessRole, PlatformRole } from "./rbac";

export interface Membership {
  orgId: string;
  orgName: string;
  orgSlug: string;
  role: BusinessRole;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  initials: string;
  platformRole: PlatformRole;
  kycStatus: string;
  status: string;
  country: string;
  memberships: Membership[];
}
