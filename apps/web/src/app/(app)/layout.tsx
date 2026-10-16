import { AppShell } from "@/components/app-shell";
import { ownerInitial } from "@/components/workspace-badge";
import { requireOrg } from "@/server/auth/session";
import { db } from "@/server/db";
import { can } from "@/server/permissions";
import { loadNotifications, loadWallet } from "@/server/shell-data";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireOrg();
  const [wallet, owners] = await Promise.all([
    loadWallet(ctx.organisation.id),
    // The owner of each workspace this person belongs to (for the briefcase initial).
    db.membership.findMany({
      where: { organisationId: { in: ctx.memberships.map((m) => m.organisationId) }, role: "OWNER" },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  const notifications = await loadNotifications(ctx.organisation.id, ctx.role, wallet);

  const workspaces = ctx.memberships.map((m) => {
    const owner = owners.find((o) => o.organisationId === m.organisationId)?.user;
    return {
      id: m.organisationId,
      name: m.organisationName,
      letter: ownerInitial(owner),
      ownerFirstName: owner?.name?.trim().split(/\s+/)[0] || owner?.email.split("@")[0] || "—",
      role: m.role,
    };
  });

  return (
    <AppShell
      user={ctx.user}
      organisation={ctx.organisation}
      role={ctx.role}
      workspaces={workspaces}
      wallet={wallet}
      notifications={notifications}
      canBilling={can(ctx.role, "billing:manage")}
      canInvite={can(ctx.role, "member:manage")}
    >
      {children}
    </AppShell>
  );
}
