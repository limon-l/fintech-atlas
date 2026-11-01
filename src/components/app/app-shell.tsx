import type { ReactNode } from "react";
import { getDb } from "@/db/client";
import { notificationsForUser, unreadNotificationCount } from "@/server/personal";
import { ROLE_LABELS, type BusinessRole, type PlatformRole } from "@/domain/rbac";
import { Topbar } from "./topbar";
import { Sidebar } from "./sidebar";
import { MobileBottomNav } from "./mobile-nav";
import type { Section } from "./nav-config";

export function AppShell({
  section,
  user,
  children,
  orgName,
  orgs,
  activeOrgId,
  role,
}: {
  section: Section;
  user: {
    id: string;
    name: string;
    initials: string;
    email: string;
    platformRole: PlatformRole;
  };
  children: ReactNode;
  orgName?: string;
  orgs?: Array<{ id: string; name: string }>;
  activeOrgId?: string;
  role?: BusinessRole;
}) {
  const db = getDb();
  const notifications = notificationsForUser(db, user.id, 8);
  const unread = unreadNotificationCount(db, user.id);
  const roleLabel = role ? ROLE_LABELS[role] : ROLE_LABELS[user.platformRole];

  return (
    <div className="min-h-dvh lg:flex">
      <Sidebar
        section={section}
        user={user}
        orgName={orgName}
        roleLabel={roleLabel}
      />
      <div className="min-w-0 flex-1">
        <Topbar
          section={section}
          user={user}
          notifications={notifications}
          unread={unread}
          orgName={orgName}
          orgs={orgs}
          activeOrgId={activeOrgId}
        />
        <main className="mx-auto w-full max-w-[1440px] px-4 pb-24 pt-5 sm:px-6 sm:pt-6 lg:px-8 lg:pb-12">
          {children}
        </main>
      </div>
      <MobileBottomNav section={section} />
    </div>
  );
}
