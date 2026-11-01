import Link from "next/link";
import { ArrowRight, BookOpen, Braces, FileCheck2, ShieldCheck } from "lucide-react";
import { DOCS } from "@/lib/docs";
import { Badge } from "@/components/ui/badge";
import { Disclosure } from "@/components/ui/misc";

export const metadata = {
  title: "Documentation · ATLAS",
  description: "Architecture, ledger, RBAC, design and release evidence for the ATLAS sandbox.",
};

const GROUPS = ["Product", "Engineering", "Evidence"] as const;

const ICONS = {
  Product: BookOpen,
  Engineering: Braces,
  Evidence: FileCheck2,
} as const;

export default function DocsIndexPage() {
  return (
    <div className="space-y-8">
      <header className="max-w-3xl">
        <p className="eyebrow mb-2">Documentation</p>
        <h1 className="text-[34px] font-semibold tracking-[-0.04em] sm:text-[44px]">The system, written down.</h1>
        <p className="mt-3 text-[14px] leading-relaxed text-muted">
          These documents describe the implementation that exists in this repository. They separate what is
          tested from what remains a sandbox limitation, and they never claim production financial readiness.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge variant="teal"><ShieldCheck className="h-3 w-3" /> Double-entry ledger</Badge>
          <Badge variant="outline">Server-enforced RBAC</Badge>
          <Badge variant="outline">Synthetic data only</Badge>
        </div>
      </header>

      <div className="space-y-8">
        {GROUPS.map((group) => {
          const Icon = ICONS[group];
          return (
            <section key={group}>
              <div className="mb-3 flex items-center gap-2">
                <Icon className="h-4 w-4 text-primary" />
                <h2 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">{group}</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {DOCS.filter((doc) => doc.group === group).map((doc) => (
                  <Link
                    key={doc.slug}
                    href={`/docs/${doc.slug}`}
                    className="group surface-card flex flex-col p-4 transition-all hover:-translate-y-0.5 hover:border-border-strong"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-[13.5px] font-semibold tracking-tight">{doc.title}</h3>
                      <ArrowRight className="h-3.5 w-3.5 text-subtle transition-colors group-hover:text-primary" />
                    </div>
                    <p className="mt-2 flex-1 text-[11.5px] leading-relaxed text-muted">{doc.description}</p>
                    <p className="mono mt-3 text-[9px] uppercase tracking-[0.12em] text-subtle">{doc.file}</p>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <Disclosure>
        Documentation is maintained in the repository under <span className="mono">docs/</span>. The rendered pages
        read the same files, so the site and the source cannot drift silently.
      </Disclosure>
    </div>
  );
}
