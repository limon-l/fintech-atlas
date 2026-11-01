import { AppShell } from "@/components/app/app-shell";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "Personal workspace" };

export default async function PersonalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/app");
  return (
    <AppShell section="app" user={user}>
      {children}
    </AppShell>
  );
}
