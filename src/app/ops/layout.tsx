import { AppShell } from "@/components/app/app-shell";
import { requireOps } from "@/lib/auth";

export const metadata = { title: "Operations" };

export default async function OpsLayout({ children }: { children: React.ReactNode }) {
  const user = await requireOps("ops:read");
  return (
    <AppShell section="ops" user={user}>
      {children}
    </AppShell>
  );
}
