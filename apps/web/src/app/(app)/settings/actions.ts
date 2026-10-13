"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { sendLoginLink } from "@/server/auth/login";
import { requirePermission } from "@/server/auth/session";
import { normaliseEmail } from "@/server/auth/tokens";
import { audit } from "@/server/agents";
import { db } from "@/server/db";
import { canChangeRole, canRemoveMember, ROLES, type Role } from "@/server/permissions";
import { loginByEmail } from "@/server/rate-limit";

const roleSchema = z.enum(ROLES as [Role, ...Role[]]);
const back = (query: string) => redirect(`/settings?${query}`);

export async function renameOrganisation(form: FormData): Promise<void> {
  const ctx = await requirePermission("organisation:edit");
  const name = z.string().trim().min(2).max(80).safeParse(form.get("name"));
  if (!name.success) back("error=name");
  else {
    await db.organisation.update({ where: { id: ctx.organisation.id }, data: { name: name.data } });
    await audit(ctx.organisation.id, ctx.user.id, "organisation.renamed", undefined, { name: name.data });
    revalidatePath("/", "layout");
    back("saved=1");
  }
}

export async function inviteMember(form: FormData): Promise<void> {
  const ctx = await requirePermission("member:manage");
  const parsed = z
    .object({ email: z.string().trim().max(254).email(), role: roleSchema })
    .safeParse({ email: form.get("email"), role: form.get("role") });
  if (!parsed.success) return back("error=invite");

  const email = normaliseEmail(parsed.data.email);
  const role = parsed.data.role;
  if (role === "OWNER" && ctx.role !== "OWNER") return back("error=owner-only");
  if (!loginByEmail.check(email).allowed) return back("error=rate");

  const user = await db.user.upsert({ where: { email }, create: { email }, update: {} });
  await db.membership.upsert({
    where: { userId_organisationId: { userId: user.id, organisationId: ctx.organisation.id } },
    create: { userId: user.id, organisationId: ctx.organisation.id, role },
    update: {},
  });
  await audit(ctx.organisation.id, ctx.user.id, "member.invited", { type: "user", id: user.id }, { email, role });
  await sendLoginLink(email, { invitedTo: ctx.organisation.name });
  revalidatePath("/settings");
  back("invited=1");
}

async function loadTarget(organisationId: string, membershipId: string) {
  const target = await db.membership.findFirst({ where: { id: membershipId, organisationId } });
  const ownerCount = await db.membership.count({ where: { organisationId, role: "OWNER" } });
  return { target, ownerCount };
}

export async function changeRole(form: FormData): Promise<void> {
  const ctx = await requirePermission("member:manage");
  const membershipId = z.string().min(1).parse(form.get("membershipId"));
  const newRole = roleSchema.parse(form.get("role"));
  const { target, ownerCount } = await loadTarget(ctx.organisation.id, membershipId);
  if (!target) return back("error=not-found");

  const check = canChangeRole({ actorRole: ctx.role, actorIsTarget: target.userId === ctx.user.id, targetRole: target.role, newRole, ownerCount });
  if (!check.ok) return back(`error=${encodeURIComponent(check.reason)}`);

  await db.membership.update({ where: { id: target.id }, data: { role: newRole } });
  await audit(ctx.organisation.id, ctx.user.id, "member.role_changed", { type: "user", id: target.userId }, { from: target.role, to: newRole });
  revalidatePath("/settings");
  back("saved=1");
}

export async function removeMember(form: FormData): Promise<void> {
  const ctx = await requirePermission("member:manage");
  const membershipId = z.string().min(1).parse(form.get("membershipId"));
  const { target, ownerCount } = await loadTarget(ctx.organisation.id, membershipId);
  if (!target) return back("error=not-found");

  const check = canRemoveMember({ actorRole: ctx.role, actorIsTarget: target.userId === ctx.user.id, targetRole: target.role, ownerCount });
  if (!check.ok) return back(`error=${encodeURIComponent(check.reason)}`);

  await db.membership.delete({ where: { id: target.id } });
  await db.session.updateMany({ where: { userId: target.userId, activeOrganisationId: ctx.organisation.id }, data: { activeOrganisationId: null } });
  await audit(ctx.organisation.id, ctx.user.id, "member.removed", { type: "user", id: target.userId });
  revalidatePath("/settings");
  back("saved=1");
}
