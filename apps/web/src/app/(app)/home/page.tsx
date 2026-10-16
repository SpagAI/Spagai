import type { Metadata } from "next";
import { ZaraChat } from "@/components/zara/zara-chat";
import { requireOrg } from "@/server/auth/session";
import { db } from "@/server/db";
import { can } from "@/server/permissions";

export const metadata: Metadata = { title: "Home" };

/** Home: ask Zara, our AI, to plan and build an agent. */
export default async function HomePage() {
  const ctx = await requireOrg();
  const recent = await db.agent.findMany({
    where: { organisationId: ctx.organisation.id },
    orderBy: { createdAt: "desc" },
    take: 3,
    select: { id: true, name: true },
  });
  const firstName = ctx.user.name?.trim().split(/\s+/)[0] || ctx.user.email.split("@")[0]!;
  return <ZaraChat firstName={firstName} company={ctx.organisation.name} canBuild={can(ctx.role, "agent:edit")} recent={recent} />;
}
