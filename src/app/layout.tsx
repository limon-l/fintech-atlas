import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Manrope } from "next/font/google";
import { Toaster } from "sonner";
import { QueryProvider } from "@/components/query-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/interactive";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "ATLAS — The sandbox fintech operating system",
    template: "%s · ATLAS",
  },
  description:
    "A premium sandbox fintech operating system: customer banking, business finance, operations, and a double-entry ledger with every movement provable.",
  applicationName: "ATLAS",
  keywords: [
    "fintech",
    "double-entry ledger",
    "sandbox banking",
    "business finance",
    "financial operations",
  ],
  authors: [{ name: "ATLAS" }],
  openGraph: {
    title: "ATLAS — The sandbox fintech operating system",
    description:
      "Customer banking, business finance, operations and a double-entry ledger in one coherent sandbox.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f7fb" },
    { media: "(prefers-color-scheme: dark)", color: "#070e1a" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${manrope.variable} ${plexMono.variable} min-h-dvh antialiased`}>
        <ThemeProvider>
          <QueryProvider>
            <TooltipProvider>
              {children}
              <Toaster position="top-center" closeButton richColors />
            </TooltipProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
