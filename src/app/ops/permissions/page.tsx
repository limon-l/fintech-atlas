import { KeyRound, LockKeyhole, ShieldCheck, Users } from "lucide-react";
import { requireOps } from "@/lib/auth";
import { businessPermissions, platformPermissions, ROLE_LABELS, type BusinessRole, type PlatformRole } from "@/domain/rbac";
import { PageHeader, SandboxNote, Panel, Disclosure } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Roles & permissions" };

const PLATFORM_ROLES: PlatformRole[] = ["customer", "support", "risk", "compliance", "admin", "super_admin"];
const BUSINESS_ROLES: BusinessRole[] = ["owner", "finance_manager", "approver", "employee"];

function PermissionList({ permissions }: { permissions: string[] }) {
  if (permissions.length === 0) return <p className="text-[10.5px] text-subtle">No platform permissions.</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {permissions.map((permission) => (
        <Badge key={permission} variant="outline" className="mono text-[9px] font-medium">{permission}</Badge>
      ))}
    </div>
  );
}

export default async function OpsPermissionsPage() {
  await requireOps("ops:admin");

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Operations · platform"
        title="Roles & permissions"
        description="Explicit permissions checked on the server for every action. Resource ownership and maker-checker rules are enforced separately."
      />
      <SandboxNote />

      <section className="grid gap-4 lg:grid-cols-2">
        <Panel title="Platform roles" description="Trust and operations staff">
          <div className="space-y-3">
            {PLATFORM_ROLES.map((role) => (
              <div key={role} className="rounded-[10px] border border-border bg-surface p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11.5px] font-semibold">{ROLE_LABELS[role]}</p>
                  <Badge variant="outline" className="mono text-[9px]">{role}</Badge>
                </div>
                <div className="mt-2">
                  <PermissionList permissions={platformPermissions(role)} />
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Organization roles" description="Business workspace memberships">
          <div className="space-y-3">
            {BUSINESS_ROLES.map((role) => (
              <div key={role} className="rounded-[10px] border border-border bg-surface p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11.5px] font-semibold">{ROLE_LABELS[role]}</p>
                  <Badge variant="outline" className="mono text-[9px]">{role}</Badge>
                </div>
                <div className="mt-2">
                  <PermissionList permissions={businessPermissions(role)} />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <Panel title="Enforcement rules" description="Beyond the permission list">
        <ul className="space-y-3">
          {[
            [ShieldCheck, "Server-side checks", "Pages call requireOps / requireBusiness and services re-check the permission before writing."],
            [LockKeyhole, "Ownership scoping", "Customer and organization queries filter by the authenticated owner. A permission never grants access to another tenant's records."],
            [Users, "Maker-checker", "Business approvals reject self-approval even when the actor holds the deciding role."],
            [KeyRound, "Step-up PIN", "Sensitive operations and approval decisions verify a hashed PIN with rate limiting."],
          ].map(([Icon, title, body]) => {
            const Component = Icon as typeof ShieldCheck;
            return (
              <li key={String(title)} className="flex gap-2.5">
                <Component className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div>
                  <p className="text-[11.5px] font-semibold">{String(title)}</p>
                  <p className="mt-0.5 text-[10.5px] leading-relaxed text-muted">{String(body)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </Panel>

      <Disclosure>This matrix documents the sandbox implementation. It is not a certification against a regulatory framework.</Disclosure>
    </div>
  );
}
