import { AppShell } from "@/components/app/app-shell";
import { requireBusiness } from "@/lib/auth";

export const metadata = { title: "Business workspace" };

export default async function BusinessLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireBusiness();
  return (
    <AppShell
      section="business"
      user={ctx.user}
      orgName={ctx.orgName}
      orgs={ctx.user.memberships.map((membership) => ({ id: membership.orgId, name: membership.orgName }))}
      activeOrgId={ctx.orgId}
      role={ctx.role}
    >
      {children}
    </AppShell>
  );
}
