import { AppShell } from "@/components/app-shell";
import { requireOrg } from "@/server/auth/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireOrg();
  return (
    <AppShell user={ctx.user} organisation={ctx.organisation} role={ctx.role} memberships={ctx.memberships}>
      {children}
    </AppShell>
  );
}
