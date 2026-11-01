export const DEMO_PASSWORD = "atlas-demo-2026";
export const DEMO_PIN = "246810";

export interface DemoPersona {
  email: string;
  name: string;
  initials: string;
  role: string;
  blurb: string;
  area: "Personal" | "Business" | "Operations";
  href: string;
  tone: "primary" | "teal" | "violet";
}

export const DEMO_PERSONAS: DemoPersona[] = [
  {
    email: "maya@atlas.demo",
    name: "Maya Chen",
    initials: "MC",
    role: "Customer",
    blurb: "Multi-currency wallets, budgets, goals and cards.",
    area: "Personal",
    href: "/app",
    tone: "primary",
  },
  {
    email: "jonas@atlas.demo",
    name: "Jonas Reed",
    initials: "JR",
    role: "Business owner",
    blurb: "Northwind Studio treasury, invoicing and controls.",
    area: "Business",
    href: "/business",
    tone: "teal",
  },
  {
    email: "priya@atlas.demo",
    name: "Priya Nair",
    initials: "PN",
    role: "Finance manager",
    blurb: "Bills, payouts, approvals and reporting.",
    area: "Business",
    href: "/business",
    tone: "teal",
  },
  {
    email: "leo@atlas.demo",
    name: "Leo Fischer",
    initials: "LF",
    role: "Approver",
    blurb: "First-line approval queue and spend policy.",
    area: "Business",
    href: "/business/approvals",
    tone: "teal",
  },
  {
    email: "sam@atlas.demo",
    name: "Sam Okafor",
    initials: "SO",
    role: "Employee",
    blurb: "Expense submission and corporate card visibility.",
    area: "Business",
    href: "/business/expenses",
    tone: "teal",
  },
  {
    email: "nadia@atlas.demo",
    name: "Nadia Haddad",
    initials: "NH",
    role: "Risk analyst",
    blurb: "Velocity, beneficiary and payment risk review.",
    area: "Operations",
    href: "/ops/risk",
    tone: "violet",
  },
  {
    email: "owen@atlas.demo",
    name: "Owen Blake",
    initials: "OB",
    role: "Support agent",
    blurb: "Customer 360 and support queue.",
    area: "Operations",
    href: "/ops/support",
    tone: "violet",
  },
  {
    email: "elena@atlas.demo",
    name: "Elena Voss",
    initials: "EV",
    role: "Compliance officer",
    blurb: "KYC, KYB and AML casework.",
    area: "Operations",
    href: "/ops/compliance",
    tone: "violet",
  },
  {
    email: "admin@atlas.demo",
    name: "Atlas Operator",
    initials: "AO",
    role: "Super admin",
    blurb: "Reconciliation, ledger inspection and platform health.",
    area: "Operations",
    href: "/ops",
    tone: "violet",
  },
];
