import Link from "next/link";
import { ArrowUpRight, BookOpenCheck, Building2, ShieldCheck } from "lucide-react";
import { AtlasWordmark } from "@/components/brand/logo";
import { Avatar } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import type { Section } from "./nav-config";
import { NavList } from "./nav-list";

export function Sidebar({
  section,
  user,
  orgName,
  roleLabel,
}: {
  section: Section;
  user: { name: string; initials: string; email: string };
  orgName?: string;
  roleLabel: string;
}) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-[252px] shrink-0 flex-col border-r border-border bg-surface/55 lg:flex">
      <div className="flex h-[60px] items-center border-b border-border/80 px-5">
        <Link href="/" aria-label="ATLAS home">
          <AtlasWordmark subtitle="Sandbox OS" />
        </Link>
      </div>

      <div className="mx-3 mt-3 rounded-[11px] border border-border bg-surface p-3 shadow-soft">
        <div className="flex items-center gap-2.5">
          <Avatar initials={user.initials} name={user.name} size="md" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-semibold">{user.name}</p>
            <p className="truncate text-[10px] text-muted">{roleLabel}</p>
          </div>
        </div>
        <div className="mt-2.5 flex items-center gap-1.5 rounded-[7px] bg-surface-2 px-2 py-1.5">
          {orgName ? (
            <>
              <Building2 className="h-3 w-3 text-subtle" />
              <span className="truncate text-[10px] font-medium text-muted">{orgName}</span>
            </>
          ) : (
            <>
              <ShieldCheck className="h-3 w-3 text-subtle" />
              <span className="truncate text-[10px] font-medium text-muted">Personal workspace</span>
            </>
          )}
          <Badge variant="teal" className="ml-auto !px-1.5 !py-0.5 !text-[7.5px]">Sandbox</Badge>
        </div>
      </div>

      <div className="no-scrollbar mt-5 min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        <NavList section={section} />
      </div>

      <div className="border-t border-border p-3">
        <Link
          href="/docs/ledger"
          className="flex items-center gap-2 rounded-[8px] px-3 py-2 text-[11px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
        >
          <BookOpenCheck className="h-3.5 w-3.5" /> Ledger specification
          <ArrowUpRight className="ml-auto h-3 w-3 text-subtle" />
        </Link>
        <p className="mono mt-2 px-3 text-[8.5px] uppercase tracking-[0.14em] text-subtle">
          Synthetic money · v0.1
        </p>
      </div>
    </aside>
  );
}
