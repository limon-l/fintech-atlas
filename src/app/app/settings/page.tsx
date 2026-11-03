import Link from "next/link";
import { Bell, KeyRound, LifeBuoy, ShieldCheck, Smartphone, UserRound } from "lucide-react";
import { getDb } from "@/db/client";
import { requireUser } from "@/lib/auth";
import { notificationsForUser, unreadNotificationCount } from "@/server/personal";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/app/actions/personal";
import { PageHeader, SandboxNote, Panel, Disclosure, KeyValue, EmptyState } from "@/components/ui/misc";
import { Badge, StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProfileForm, SupportForm } from "@/components/app/settings-forms";
import { formatDateTime, relativeTime } from "@/lib/utils";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser("/app/settings");
  const db = getDb();
  const profile = db
    .prepare("SELECT name, email, country, timezone, kyc_status, created_at, last_login_at FROM users WHERE id = ?")
    .get(user.id) as {
    name: string;
    email: string;
    country: string;
    timezone: string;
    kyc_status: string;
    created_at: string;
    last_login_at: string | null;
  };
  const sessions = db
    .prepare(
      `SELECT id, created_at, expires_at, ip, user_agent FROM sessions
       WHERE user_id = ? AND revoked_at IS NULL AND expires_at > ? ORDER BY created_at DESC LIMIT 5`,
    )
    .all(user.id, new Date().toISOString()) as Array<{
    id: string;
    created_at: string;
    expires_at: string;
    ip: string | null;
    user_agent: string | null;
  }>;
  const notifications = notificationsForUser(db, user.id, 6);
  const unread = unreadNotificationCount(db, user.id);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Personal · account"
        title="Settings"
        description="Profile, security posture, notification history and support — all scoped to your signed-in identity."
        actions={
          <Button asChild variant="secondary" size="sm">
            <Link href="/app/insights"><ShieldCheck className="h-3.5 w-3.5" /> Security insights</Link>
          </Button>
        }
      />
      <SandboxNote />

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Panel title="Profile" description="Identity details used across the workspace">
          <ProfileForm name={profile.name} email={profile.email} country={profile.country} timezone={profile.timezone} />
        </Panel>

        <Panel title="Account posture" description="Read-only compliance snapshot">
          <dl className="divide-y divide-border/70">
            <KeyValue label="KYC status" value={<StatusPill status={profile.kyc_status} />} />
            <KeyValue label="Platform role" value={<Badge variant="outline">{user.platformRole.replace("_", " ")}</Badge>} />
            <KeyValue label="Member since" value={formatDateTime(profile.created_at).split(",")[0] ?? "—"} />
            <KeyValue label="Last sign-in" value={profile.last_login_at ? relativeTime(profile.last_login_at) : "—"} />
            <KeyValue label="Timezone" value={<span className="mono text-[11px]">{profile.timezone}</span>} />
          </dl>
          <div className="mt-3 rounded-[9px] bg-success-soft px-3 py-2 text-[10.5px] leading-relaxed text-success">
            <ShieldCheck className="mr-1 inline h-3 w-3" /> Sessions are hashed, HttpOnly and expire after eight hours.
          </div>
        </Panel>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Notifications"
          description={`${unread} unread`}
          action={
            unread > 0 ? (
              <form action={markAllNotificationsReadAction}>
                <Button type="submit" variant="ghost" size="sm">Mark all read</Button>
              </form>
            ) : null
          }
        >
          {notifications.length === 0 ? (
            <EmptyState title="Nothing to review" description="Account and transfer events will appear here." icon={<Bell className="h-5 w-5" />} />
          ) : (
            <div className="space-y-2">
              {notifications.map((notification) => (
                <div key={notification.id} className="rounded-[10px] border border-border bg-surface px-3 py-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11.5px] font-semibold">{notification.title}</p>
                      <p className="mt-0.5 text-[10.5px] leading-relaxed text-muted">{notification.body}</p>
                    </div>
                    {notification.readAt ? <Badge variant="neutral">Read</Badge> : <Badge variant="primary">New</Badge>}
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 text-[9px] text-subtle">
                    <span>{relativeTime(notification.createdAt)}</span>
                    {notification.href ? <Link href={notification.href} className="font-semibold text-primary hover:underline">Open</Link> : null}
                    {notification.readAt ? null : (
                      <form action={markNotificationReadAction}>
                        <input type="hidden" name="id" value={notification.id} />
                        <button type="submit" className="font-semibold text-primary hover:underline">Mark read</button>
                      </form>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Security" description="Controls that protect sensitive actions">
          <div className="space-y-3">
            {[
              [KeyRound, "Step-up PIN", "Every transfer, FX conversion and approval decision requires a six-digit PIN verified server-side."],
              [Smartphone, "Session inventory", `${sessions.length} active session${sessions.length === 1 ? "" : "s"} in the last eight hours.`],
              [ShieldCheck, "Rate limiting", "PIN attempts are limited to five per five minutes. Sign-in is limited per IP and per account."],
              [UserRound, "Ownership scoping", "Account, transaction and beneficiary queries always filter by the signed-in owner."],
            ].map(([Icon, title, body]) => {
              const Component = Icon as typeof KeyRound;
              return (
                <div key={String(title)} className="flex gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-surface-2 text-muted">
                    <Component className="h-3.5 w-3.5" />
                  </span>
                  <div>
                    <p className="text-[11.5px] font-semibold">{String(title)}</p>
                    <p className="mt-0.5 text-[10.5px] leading-relaxed text-muted">{String(body)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Panel title="Support" description="Open a request for the operations queue">
          <SupportForm />
        </Panel>

        <Panel title="Active sessions" description="Hashed tokens, never raw cookies">
          {sessions.length === 0 ? (
            <EmptyState title="No active sessions" icon={<LifeBuoy className="h-5 w-5" />} />
          ) : (
            <div className="space-y-2">
              {sessions.map((session) => (
                <div key={session.id} className="rounded-[9px] border border-border bg-surface px-3 py-2">
                  <p className="mono text-[10px] text-muted">{session.ip ?? "local"} · {session.id.slice(0, 12)}…</p>
                  <p className="mt-0.5 text-[9px] text-subtle">
                    Started {relativeTime(session.created_at)} · expires {relativeTime(session.expires_at)}
                  </p>
                  <p className="mt-0.5 truncate text-[9px] text-subtle">{session.user_agent ?? "Unknown client"}</p>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </section>

      <Disclosure>
        Demo credentials are public by design. Never reuse the demo password or PIN for a real account. This
        environment is synthetic and does not process live money.
      </Disclosure>
    </div>
  );
}
