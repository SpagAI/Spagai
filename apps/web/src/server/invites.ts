import "server-only";
import { z } from "zod";
import { audit } from "./agents";
import { sendLoginLink } from "./auth/login";
import type { OrgContext } from "./auth/session";
import { normaliseEmail } from "./auth/tokens";
import { db } from "./db";
import { ROLES, type Role } from "./permissions";
import { loginByEmail } from "./rate-limit";

export type InviteError = "invite" | "owner-only" | "rate";

/**
 * Invite someone to the current workspace (shared by Settings and the workspace switcher).
 * The caller must already have checked "member:manage".
 */
export async function inviteToWorkspace(ctx: OrgContext, rawEmail: unknown, rawRole: unknown): Promise<{ ok: true; email: string } | { ok: false; error: InviteError }> {
  const parsed = z
    .object({ email: z.string().trim().max(254).email(), role: z.enum(ROLES as [Role, ...Role[]]) })
    .safeParse({ email: rawEmail, role: rawRole });
  if (!parsed.success) return { ok: false, error: "invite" };

  const email = normaliseEmail(parsed.data.email);
  const role = parsed.data.role;
  if (role === "OWNER" && ctx.role !== "OWNER") return { ok: false, error: "owner-only" };
  if (!loginByEmail.check(email).allowed) return { ok: false, error: "rate" };

  const user = await db.user.upsert({ where: { email }, create: { email }, update: {} });
  await db.membership.upsert({
    where: { userId_organisationId: { userId: user.id, organisationId: ctx.organisation.id } },
    create: { userId: user.id, organisationId: ctx.organisation.id, role },
    update: {},
  });
  await audit(ctx.organisation.id, ctx.user.id, "member.invited", { type: "user", id: user.id }, { email, role });
  await sendLoginLink(email, { invitedTo: ctx.organisation.name });
  return { ok: true, email };
}
