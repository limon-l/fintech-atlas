"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Bell,
  Building2,
  Check,
  ChevronDown,
  Command,
  LogOut,
  Menu,
  Search,
  Settings,
  ShieldCheck,
  User,
} from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { signOutAction, switchOrgAction } from "@/app/actions/auth";
import { markAllNotificationsReadAction } from "@/app/actions/personal";
import { Avatar } from "@/components/ui/misc";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { SheetContent } from "@/components/ui/overlay";
import { DropdownContent, DropdownItem, DropdownLabel, DropdownMenu, DropdownMenuTrigger, DropdownSeparator } from "@/components/ui/dropdown";
import type { NotificationView } from "@/server/personal";
import { NAV, SECTION_LABEL, type Section } from "./nav-config";
import { NavList } from "./nav-list";
import { cn, relativeTime, titleCase } from "@/lib/utils";

export interface TopbarUser {
  name: string;
  initials: string;
  email: string;
  platformRole: string;
}

export function Topbar({
  section,
  user,
  notifications,
  unread,
  orgName,
  orgs = [],
  activeOrgId,
}: {
  section: Section;
  user: TopbarUser;
  notifications: NotificationView[];
  unread: number;
  orgName?: string;
  orgs?: Array<{ id: string; name: string }>;
  activeOrgId?: string;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const links = useMemo(
    () =>
      (["app", "business", "ops"] as Section[]).flatMap((key) =>
        NAV[key].flatMap((group) =>
          group.items.map((item) => ({
            ...item,
            group: `${SECTION_LABEL[key]} · ${group.label}`,
          })),
        ),
      ),
    [],
  );

  return (
    <header className="sticky top-0 z-30 flex h-[60px] items-center gap-3 border-b border-border/80 bg-background/85 px-4 backdrop-blur-xl sm:px-6">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation"
      >
        <Menu className="h-4 w-4" />
      </Button>

      <div className="hidden min-w-0 items-center gap-2 sm:flex">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-subtle">
          {SECTION_LABEL[section]}
        </span>
        {orgName ? (
          <>
            <span className="text-subtle">/</span>
            <span className="truncate text-[12px] font-medium text-muted">{orgName}</span>
          </>
        ) : null}
        <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-teal/20 bg-teal-soft px-2 py-0.5 text-[8.5px] font-bold uppercase tracking-[0.1em] text-teal">
          <span className="h-1 w-1 rounded-full bg-teal" /> Sandbox
        </span>
      </div>

      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="hidden h-8 items-center gap-2 rounded-[8px] border border-border bg-surface px-2.5 text-[11px] text-subtle transition-colors hover:border-border-strong hover:text-muted sm:flex"
        >
          <Search className="h-3.5 w-3.5" />
          <span>Search or jump</span>
          <span className="mono ml-2 rounded border border-border bg-surface-2 px-1 py-0.5 text-[8px]">⌘K</span>
        </button>
        <ThemeToggle />
        <NotificationMenu notifications={notifications} unread={unread} />
        <UserMenu user={user} orgs={orgs} activeOrgId={activeOrgId} />
      </div>

      <DialogPrimitive.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent title="ATLAS" description={orgName ?? SECTION_LABEL[section]} side="left" className="max-w-[290px]">
          <div className="mb-5 flex items-center gap-2 rounded-[9px] border border-border bg-surface-2 px-3 py-2">
            <Avatar initials={user.initials} name={user.name} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-[12px] font-semibold">{user.name}</p>
              <p className="truncate text-[10px] text-muted">{user.email}</p>
            </div>
          </div>
          <NavList section={section} onNavigate={() => setMobileOpen(false)} />
          <div className="mt-6 space-y-1 border-t border-border pt-4">
            <Link href="/app" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 rounded-md px-3 py-2 text-[12px] text-muted hover:bg-surface-2">
              <User className="h-4 w-4" /> Personal workspace
            </Link>
            <Link href="/business" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 rounded-md px-3 py-2 text-[12px] text-muted hover:bg-surface-2">
              <Building2 className="h-4 w-4" /> Business workspace
            </Link>
            <Link href="/ops" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 rounded-md px-3 py-2 text-[12px] text-muted hover:bg-surface-2">
              <ShieldCheck className="h-4 w-4" /> Operations
            </Link>
          </div>
        </SheetContent>
      </DialogPrimitive.Root>

      <DialogPrimitive.Root open={paletteOpen} onOpenChange={setPaletteOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="atlas-overlay fixed inset-0 z-50 bg-[var(--overlay)] backdrop-blur-[3px]" />
          <DialogPrimitive.Content className="atlas-dialog fixed left-1/2 top-[12vh] z-50 w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 rounded-[16px] border border-border bg-elevated shadow-float focus:outline-none">
            <DialogPrimitive.Title className="sr-only">Command palette</DialogPrimitive.Title>
            <CommandPalette links={links} onNavigate={(href) => { setPaletteOpen(false); router.push(href); }} />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </header>
  );
}

function CommandPalette({
  links,
  onNavigate,
}: {
  links: Array<{ href: string; label: string; group: string }>;
  onNavigate: (href: string) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return links.slice(0, 9);
    return links
      .filter((link) => `${link.label} ${link.group} ${link.href}`.toLowerCase().includes(q))
      .slice(0, 12);
  }, [links, query]);

  return (
    <div>
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
        <Search className="h-4 w-4 text-subtle" />
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Jump to a page, ledger, approval…"
          className="h-7 flex-1 bg-transparent text-[13px] outline-none placeholder:text-subtle"
        />
        <span className="mono rounded border border-border bg-surface-2 px-1.5 py-0.5 text-[8.5px] text-subtle">ESC</span>
      </div>
      <div className="max-h-[52vh] overflow-y-auto p-2">
        {filtered.length === 0 ? (
          <p className="px-3 py-8 text-center text-[12px] text-muted">No matching destination.</p>
        ) : (
          filtered.map((link) => (
            <button
              key={link.href}
              type="button"
              onClick={() => onNavigate(link.href)}
              className="flex w-full items-center gap-3 rounded-[8px] px-3 py-2.5 text-left transition-colors hover:bg-surface-2"
            >
              <ArrowRight className="h-3.5 w-3.5 text-subtle" />
              <span className="flex-1 text-[12.5px] font-medium">{link.label}</span>
              <span className="text-[9.5px] uppercase tracking-[0.08em] text-subtle">{link.group}</span>
            </button>
          ))
        )}
      </div>
      <div className="flex items-center justify-between border-t border-border px-4 py-2 text-[9px] uppercase tracking-[0.1em] text-subtle">
        <span>Navigate</span>
        <span className="inline-flex items-center gap-1"><Command className="h-3 w-3" /> K</span>
      </div>
    </div>
  );
}

function NotificationMenu({ notifications, unread }: { notifications: NotificationView[]; unread: number }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}>
          <Bell className="h-4 w-4" />
          {unread > 0 ? (
            <span className="absolute right-1.5 top-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-danger px-0.5 text-[8px] font-bold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownContent className="w-[330px] p-0">
        <div className="flex items-center justify-between border-b border-border px-3.5 py-3">
          <div>
            <p className="text-[12px] font-semibold">Notifications</p>
            <p className="text-[9.5px] text-subtle">{unread} unread</p>
          </div>
          {unread > 0 ? (
            <form action={markAllNotificationsReadAction}>
              <button type="submit" className="text-[10px] font-semibold text-primary hover:underline">Mark all read</button>
            </form>
          ) : null}
        </div>
        <div className="max-h-[340px] overflow-y-auto p-1.5">
          {notifications.length === 0 ? (
            <p className="px-3 py-8 text-center text-[11.5px] text-muted">You are all caught up.</p>
          ) : (
            notifications.map((notification) => (
              <Link
                key={notification.id}
                href={notification.href ?? "/app"}
                className={cn(
                  "block rounded-[8px] px-3 py-2.5 transition-colors hover:bg-surface-2",
                  !notification.readAt && "bg-primary-soft/40",
                )}
              >
                <div className="flex items-start gap-2">
                  <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", notification.readAt ? "bg-transparent" : "bg-primary")} />
                  <div className="min-w-0">
                    <p className="text-[11.5px] font-semibold leading-snug">{notification.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-[10.5px] leading-relaxed text-muted">{notification.body}</p>
                    <p className="mt-1 text-[9px] text-subtle">{relativeTime(notification.createdAt)}</p>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </DropdownContent>
    </DropdownMenu>
  );
}

function UserMenu({
  user,
  orgs,
  activeOrgId,
}: {
  user: TopbarUser;
  orgs: Array<{ id: string; name: string }>;
  activeOrgId?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="ml-1 flex items-center gap-1.5 rounded-full p-0.5 transition-colors hover:bg-surface-2" aria-label="Account menu">
          <Avatar initials={user.initials} name={user.name} size="sm" />
          <ChevronDown className="hidden h-3 w-3 text-subtle sm:block" />
        </button>
      </DropdownMenuTrigger>
      <DropdownContent className="w-[250px]">
        <div className="px-2.5 py-2">
          <p className="text-[12px] font-semibold">{user.name}</p>
          <p className="truncate text-[10px] text-muted">{user.email}</p>
          <span className="mt-1.5 inline-flex rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[8.5px] font-semibold uppercase tracking-[0.08em] text-muted">
            {titleCase(user.platformRole)}
          </span>
        </div>
        <DropdownSeparator />
        {orgs.length > 0 ? (
          <>
            <DropdownLabel>Organization</DropdownLabel>
            {orgs.map((org) => (
              <form key={org.id} action={switchOrgAction}>
                <input type="hidden" name="orgId" value={org.id} />
                <button
                  type="submit"
                  className="flex w-full items-center justify-between gap-2 rounded-[7px] px-2.5 py-2 text-left text-[12.5px] font-medium text-foreground outline-none transition-colors hover:bg-surface-2 focus-visible:bg-surface-2"
                >
                  <span className="flex items-center gap-2"><Building2 className="h-3.5 w-3.5" /> {org.name}</span>
                  {org.id === activeOrgId ? <Check className="h-3.5 w-3.5 text-teal" /> : null}
                </button>
              </form>
            ))}
            <DropdownSeparator />
          </>
        ) : null}
        <DropdownItem asChild>
          <Link href="/app/settings"><Settings className="h-3.5 w-3.5" /> Settings</Link>
        </DropdownItem>
        <DropdownItem asChild>
          <Link href="/security"><ShieldCheck className="h-3.5 w-3.5" /> Security model</Link>
        </DropdownItem>
        <DropdownSeparator />
        <form action={signOutAction}>
          <button type="submit" className="flex w-full cursor-pointer items-center gap-2 rounded-[7px] px-2.5 py-2 text-left text-[12.5px] font-medium text-danger outline-none hover:bg-danger-soft">
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </form>
      </DropdownContent>
    </DropdownMenu>
  );
}
