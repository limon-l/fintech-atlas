import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, FileText } from "lucide-react";
import { DOCS, findDoc, readDoc } from "@/lib/docs";
import { Markdown } from "@/components/docs/markdown";
import { Badge } from "@/components/ui/badge";
import { Disclosure } from "@/components/ui/misc";

export const dynamicParams = false;

export function generateStaticParams() {
  return DOCS.map((doc) => ({ slug: doc.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = findDoc(slug);
  if (!entry) return { title: "Document not found" };
  return { title: `${entry.title} · ATLAS`, description: entry.description };
}

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = findDoc(slug);
  if (!entry) notFound();
  const source = await readDoc(slug);
  if (!source) notFound();
  const index = DOCS.findIndex((doc) => doc.slug === slug);
  const previous = index > 0 ? DOCS[index - 1] : undefined;
  const next = index < DOCS.length - 1 ? DOCS[index + 1] : undefined;

  return (
    <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <Link href="/docs" className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> All documentation
        </Link>
        <nav className="mt-5 space-y-5" aria-label="Documentation">
          {(["Product", "Engineering", "Evidence"] as const).map((group) => (
            <div key={group}>
              <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.15em] text-subtle">{group}</p>
              <ul className="space-y-0.5">
                {DOCS.filter((doc) => doc.group === group).map((doc) => (
                  <li key={doc.slug}>
                    <Link
                      href={`/docs/${doc.slug}`}
                      aria-current={doc.slug === slug ? "page" : undefined}
                      className={`block rounded-[7px] px-2.5 py-1.5 text-[11.5px] transition-colors ${
                        doc.slug === slug ? "bg-primary-soft font-semibold text-primary" : "text-muted hover:bg-surface-2 hover:text-foreground"
                      }`}
                    >
                      {doc.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      <article className="min-w-0">
        <header className="mb-6 border-b border-border pb-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{entry.group}</Badge>
            <span className="mono inline-flex items-center gap-1 text-[9px] uppercase tracking-[0.12em] text-subtle">
              <FileText className="h-3 w-3" /> docs/{entry.file}
            </span>
          </div>
          <p className="mt-3 text-[13px] leading-relaxed text-muted">{entry.description}</p>
        </header>

        <Markdown source={source} />

        <nav className="mt-10 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
          {previous ? (
            <Link href={`/docs/${previous.slug}`} className="group inline-flex items-center gap-2 text-[11.5px] text-muted hover:text-foreground">
              <ArrowLeft className="h-3.5 w-3.5 text-subtle group-hover:text-primary" />
              <span><span className="block text-[9px] uppercase tracking-[0.12em] text-subtle">Previous</span>{previous.title}</span>
            </Link>
          ) : <span />}
          {next ? (
            <Link href={`/docs/${next.slug}`} className="group inline-flex items-center gap-2 text-right text-[11.5px] text-muted hover:text-foreground sm:justify-end">
              <span><span className="block text-[9px] uppercase tracking-[0.12em] text-subtle">Next</span>{next.title}</span>
              <ArrowRight className="h-3.5 w-3.5 text-subtle group-hover:text-primary" />
            </Link>
          ) : null}
        </nav>

        <Disclosure className="mt-6">
          Rendered from the repository source. If a claim here is not backed by code or a test, treat it as a gap.
        </Disclosure>
      </article>
    </div>
  );
}
