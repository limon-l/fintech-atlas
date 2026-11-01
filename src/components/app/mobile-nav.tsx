"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV, type Section } from "./nav-config";
import { cn } from "@/lib/utils";

export function MobileBottomNav({ section }: { section: Section }) {
  const pathname = usePathname();
  const items = NAV[section].flatMap((group) => group.items).slice(0, 4);
  return (
    <nav
      className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur-xl lg:hidden"
      aria-label="Primary mobile navigation"
    >
      <div className="grid grid-cols-4">
        {items.map((item) => {
          const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 text-[9px] font-semibold transition-colors",
                active ? "text-primary" : "text-subtle",
              )}
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.1 : 1.7} />
              {item.label === "Bills & recurring" ? "Bills" : item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
