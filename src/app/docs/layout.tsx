import { MarketingFooter, MarketingNav } from "@/components/marketing/chrome";

export const metadata = {
  title: "Documentation · ATLAS",
  description: "Architecture, ledger, RBAC, design and release evidence for the ATLAS sandbox.",
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <MarketingNav />
      <div className="mx-auto w-full max-w-[1240px] px-5 py-10 sm:px-8 sm:py-14">{children}</div>
      <MarketingFooter />
    </div>
  );
}
