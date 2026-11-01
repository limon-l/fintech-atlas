import {
  ArrowLeftRight,
  BookOpenCheck,
  Building2,
  CreditCard,
  FileText,
  Gauge,
  Globe2,
  HeartHandshake,
  KeyRound,
  Landmark,
  LayoutDashboard,
  LifeBuoy,
  ListChecks,
  PieChart,
  ReceiptText,
  ScanSearch,
  Send,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  Wallet,
  Webhook,
  type LucideIcon,
} from "lucide-react";

export type Section = "app" | "business" | "ops";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV: Record<Section, NavGroup[]> = {
  app: [
    {
      label: "Workspace",
      items: [
        { href: "/app", label: "Overview", icon: LayoutDashboard, exact: true },
        { href: "/app/accounts", label: "Accounts", icon: Wallet },
        { href: "/app/transactions", label: "Transactions", icon: ArrowLeftRight },
        { href: "/app/transfers", label: "Transfers", icon: Send },
      ],
    },
    {
      label: "Money",
      items: [
        { href: "/app/cards", label: "Cards", icon: CreditCard },
        { href: "/app/fx", label: "FX", icon: Globe2 },
        { href: "/app/budgets", label: "Budgets", icon: PieChart },
        { href: "/app/goals", label: "Goals", icon: Target },
        { href: "/app/bills", label: "Bills & recurring", icon: ReceiptText },
      ],
    },
    {
      label: "Discover",
      items: [
        { href: "/app/insights", label: "Intelligence", icon: Sparkles },
        { href: "/app/beneficiaries", label: "Beneficiaries", icon: Users },
        { href: "/app/settings", label: "Settings", icon: Settings },
      ],
    },
  ],
  business: [
    {
      label: "Treasury",
      items: [
        { href: "/business", label: "Overview", icon: LayoutDashboard, exact: true },
        { href: "/business/invoices", label: "Invoices", icon: FileText },
        { href: "/business/bills", label: "Bills", icon: ReceiptText },
        { href: "/business/vendors", label: "Vendors", icon: Building2 },
      ],
    },
    {
      label: "Controls",
      items: [
        { href: "/business/approvals", label: "Approvals", icon: ListChecks },
        { href: "/business/expenses", label: "Expenses", icon: ScanSearch },
        { href: "/business/cards", label: "Cards", icon: CreditCard },
        { href: "/business/team", label: "Team", icon: Users },
      ],
    },
    {
      label: "Proof",
      items: [
        { href: "/business/reports", label: "Reports", icon: PieChart },
        { href: "/business/developers", label: "Developers", icon: KeyRound },
      ],
    },
  ],
  ops: [
    {
      label: "Command",
      items: [
        { href: "/ops", label: "Overview", icon: Gauge, exact: true },
        { href: "/ops/customers", label: "Customers", icon: Users },
        { href: "/ops/support", label: "Support", icon: LifeBuoy },
      ],
    },
    {
      label: "Trust",
      items: [
        { href: "/ops/risk", label: "Risk", icon: ShieldAlert },
        { href: "/ops/compliance", label: "Compliance", icon: ShieldCheck },
        { href: "/ops/reconciliation", label: "Reconciliation", icon: Landmark },
        { href: "/ops/ledger", label: "Ledger", icon: BookOpenCheck },
      ],
    },
    {
      label: "Platform",
      items: [
        { href: "/ops/audit", label: "Audit", icon: FileText },
        { href: "/ops/integrations", label: "Integrations", icon: Webhook },
        { href: "/ops/health", label: "Health", icon: HeartHandshake },
        { href: "/ops/permissions", label: "Permissions", icon: ShieldCheck },
      ],
    },
  ],
};

export const SECTION_LABEL: Record<Section, string> = {
  app: "Personal",
  business: "Business",
  ops: "Operations",
};
