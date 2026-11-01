import Link from "next/link";
import { ArrowRight, Menu } from "lucide-react";
import { AtlasWordmark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

const LINKS = [
  { href: "/#product", label: "Product" },
  { href: "/#ledger", label: "Ledger" },
  { href: "/security", label: "Security" },
  { href: "/developers", label: "Developers" },
  { href: "/pricing", label: "Pricing" },
  { href: "/docs", label: "Docs" },
];

export function MarketingNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1240px] items-center gap-6 px-5 sm:px-8">
        <Link href="/" aria-label="ATLAS home">
          <AtlasWordmark subtitle="Sandbox OS" />
        </Link>
        <nav className="ml-4 hidden items-center gap-1 lg:flex" aria-label="Main navigation">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 text-[12.5px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle className="hidden sm:inline-flex" />
          <Link href="/login" className="hidden text-[12.5px] font-semibold text-muted hover:text-foreground sm:block">
            Sign in
          </Link>
          <Button asChild size="sm">
            <Link href="/login">
              Open sandbox <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
          <Button asChild variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
            <Link href="/login">
              <Menu className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-border bg-surface/40">
      <div className="mx-auto grid max-w-[1240px] gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <AtlasWordmark subtitle="Sandbox OS" />
          <p className="mt-4 max-w-xs text-[12px] leading-relaxed text-muted">
            A portfolio-grade fintech operating system built around a double-entry ledger. All money,
            identities and rates are synthetic.
          </p>
          <p className="mono mt-5 text-[10px] uppercase tracking-[0.14em] text-subtle">
            No live financial services
          </p>
        </div>
        <FooterColumn
          title="Product"
          links={[
            ["Personal banking", "/#product"],
            ["Business finance", "/#business"],
            ["Operations", "/#operations"],
            ["Ledger", "/#ledger"],
          ]}
        />
        <FooterColumn
          title="Platform"
          links={[
            ["Security", "/security"],
            ["Developers", "/developers"],
            ["Pricing", "/pricing"],
            ["Sign in", "/login"],
          ]}
        />
        <FooterColumn
          title="Proof"
          links={[
            ["Architecture", "/docs/architecture"],
            ["Ledger spec", "/docs/ledger"],
            ["RBAC matrix", "/docs/rbac"],
            ["QA report", "/docs/qa"],
          ]}
        />
      </div>
      <div className="border-t border-border/70">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-2 px-5 py-5 text-[10.5px] text-subtle sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>© 2026 ATLAS Sandbox. Built for demonstration, not deposit-taking.</p>
          <p className="mono uppercase tracking-[0.12em]">Financial clarity × digital luxury</p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: Array<[string, string]> }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-subtle">{title}</p>
      <ul className="mt-3 space-y-2">
        {links.map(([label, href]) => (
          <li key={href}>
            <Link href={href} className="text-[12px] text-muted transition-colors hover:text-foreground">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
