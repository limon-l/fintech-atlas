"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV, type Section } from "./nav-config";
import { cn } from "@/lib/utils";

export function NavList({
  section,
  onNavigate,
  compact = false,
}: {
  section: Section;
  onNavigate?: () => void;
  compact?: boolean;
}) {
  const pathname = usePathname();
  return (
    <nav className="space-y-5" aria-label={`${section} navigation`}>
      {NAV[section].map((group) => (
        <div key={group.label}>
          <p className={cn("px-3 pb-1.5 text-[9px] font-semibold uppercase tracking-[0.15em] text-subtle", compact && "sr-only")}>
            {group.label}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group relative flex items-center gap-2.5 rounded-[8px] px-3 py-2 text-[12.5px] font-medium transition-colors",
                      active
                        ? "bg-primary-soft text-primary"
                        : "text-muted hover:bg-surface-2 hover:text-foreground",
                    )}
                  >
                    {active ? (
                      <span className="absolute -left-[9px] top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-primary" />
                    ) : null}
                    <Icon className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "text-subtle group-hover:text-foreground")} strokeWidth={1.8} />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
