import { readFile } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";

export interface DocEntry {
  slug: string;
  title: string;
  file: string;
  description: string;
  group: "Product" | "Engineering" | "Evidence";
}

export const DOCS: DocEntry[] = [
  {
    slug: "blueprint",
    title: "Product blueprint",
    file: "BLUEPRINT.md",
    description: "Product boundary, personas, module matrix, data model and page map.",
    group: "Product",
  },
  {
    slug: "architecture",
    title: "Architecture",
    file: "ARCHITECTURE.md",
    description: "Runtime shape, request flow, persistence, module boundaries and migration path.",
    group: "Engineering",
  },
  {
    slug: "ledger",
    title: "Ledger specification",
    file: "LEDGER.md",
    description: "Signed postings, invariants, holds, FX, idempotency and reversal rules.",
    group: "Engineering",
  },
  {
    slug: "rbac",
    title: "RBAC matrix",
    file: "RBAC.md",
    description: "Platform and organization roles, permissions and enforcement points.",
    group: "Engineering",
  },
  {
    slug: "design",
    title: "Design system",
    file: "DESIGN_SYSTEM.md",
    description: "Tokens, typography, surfaces, motion, components and accessibility rules.",
    group: "Engineering",
  },
  {
    slug: "implementation",
    title: "Implementation report",
    file: "IMPLEMENTATION.md",
    description: "What was built, what changed, and what remains unfinished.",
    group: "Evidence",
  },
  {
    slug: "qa",
    title: "Release QA report",
    file: "RELEASE.md",
    description: "Test evidence, smoke checks, known limits and release gates.",
    group: "Evidence",
  },
  {
    slug: "backlog",
    title: "Backlog",
    file: "BACKLOG.md",
    description: "Prioritized remaining work with explicit non-claims.",
    group: "Evidence",
  },
  {
    slug: "portfolio",
    title: "Portfolio guide",
    file: "PORTFOLIO.md",
    description: "Demonstration path, engineering talking points and resume framing.",
    group: "Evidence",
  },
];

export function findDoc(slug: string): DocEntry | undefined {
  return DOCS.find((doc) => doc.slug === slug);
}

export const readDoc = cache(async (slug: string): Promise<string | null> => {
  const entry = findDoc(slug);
  if (!entry) return null;
  try {
    return await readFile(path.join(process.cwd(), "docs", entry.file), "utf8");
  } catch {
    return null;
  }
});
