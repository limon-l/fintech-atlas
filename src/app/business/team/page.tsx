import { ShieldCheck, UserCog, Users } from "lucide-react";
import { getDb } from "@/db/client";
import { requireBusiness } from "@/lib/auth";
import { listTeam } from "@/server/business";
import { businessPermissions, ROLE_LABELS, type BusinessRole } from "@/domain/rbac";
import { PageHeader, SandboxNote, Panel, Stat, Disclosure } from "@/components/ui/misc";
import { Badge, StatusPill } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/misc";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TeamRoleForm } from "@/components/app/business-forms";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Team" };

const ROLE_ORDER: BusinessRole[] = ["owner", "finance_manager", "approver", "employee"];

export default async function TeamPage() {
  const ctx = await requireBusiness();
  const team = listTeam(getDb(), ctx.orgId);
  const isOwner = ctx.role === "owner";
  const roleCounts = ROLE_ORDER.map((role) => ({ role, count: team.filter((member) => member.role === role).length }));

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={`Business · ${ctx.orgName}`}
        title="Team & roles"
        description="Membership roles drive server-side permissions. Only an owner can change roles, and an organization must keep at least one owner."
      />
      <SandboxNote />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Members" value={team.length} hint="Active and invited" icon={<Users className="h-4 w-4" />} />
        {roleCounts.slice(1).map((entry) => (
          <Stat key={entry.role} label={ROLE_LABELS[entry.role]} value={entry.count} hint={`${businessPermissions(entry.role).length} permissions`} icon={<UserCog className="h-4 w-4" />} />
        ))}
      </section>

      <Panel title="Members" description={`${team.length} membership records`} bodyClassName="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>KYC</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Change role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {team.map((member) => (
              <TableRow key={member.id}>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <Avatar initials={member.initials} name={member.name} size="sm" />
                    <div>
                      <p className="text-[12px] font-semibold">{member.name}</p>
                      <p className="text-[10px] text-subtle">{member.email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell><Badge variant="outline">{ROLE_LABELS[member.role as BusinessRole] ?? member.role}</Badge></TableCell>
                <TableCell><StatusPill status={member.status} /></TableCell>
                <TableCell><StatusPill status={member.kyc_status} /></TableCell>
                <TableCell className="text-[11px] text-muted">{formatDate(member.created_at)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end">
                    <TeamRoleForm membershipId={member.id} role={member.role} disabled={!isOwner} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>

      <Panel title="Permission matrix" description="Effective business permissions by role">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {ROLE_ORDER.map((role) => (
            <div key={role} className="rounded-[10px] border border-border bg-surface-2/40 p-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                <p className="text-[11.5px] font-semibold">{ROLE_LABELS[role]}</p>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {businessPermissions(role).map((permission) => (
                  <span key={permission} className="mono rounded bg-surface px-1.5 py-0.5 text-[8px] text-muted">{permission}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Disclosure>Roles are enforced in the server services. UI disabling is a convenience, not the security boundary.</Disclosure>
    </div>
  );
}
