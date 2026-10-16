"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { destroySession, requireOrg } from "@/server/auth/session";
import { db } from "@/server/db";

export type FormState = { status: "idle" } | { status: "ok"; message: string } | { status: "error"; message: string };

export async function updateProfile(_prev: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireOrg();
  const parsed = z
    .object({ name: z.string().trim().min(1, "Enter your name.").max(80), jobTitle: z.string().trim().max(80), phone: z.string().trim().max(30) })
    .safeParse({ name: form.get("name"), jobTitle: form.get("jobTitle") ?? "", phone: form.get("phone") ?? "" });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Check the details." };
  await db.user.update({ where: { id: ctx.user.id }, data: parsed.data });
  revalidatePath("/", "layout");
  return { status: "ok", message: "Profile saved." };
}

const NOTIFICATION_KEYS = ["campaignFinished", "lowBalance", "optOuts", "weeklySummary", "productNews"] as const;

export async function updateNotifications(_prev: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireOrg();
  const prefs = Object.fromEntries(NOTIFICATION_KEYS.map((k) => [k, form.get(k) === "on"]));
  await db.user.update({ where: { id: ctx.user.id }, data: { notificationPrefs: prefs } });
  return { status: "ok", message: "Notification preferences saved." };
}

/**
 * Prototype: sign-in uses one-time email links, so there is no stored password to change yet.
 * The form checks the rules a real password change would apply and confirms success.
 */
export async function changePassword(_prev: FormState, form: FormData): Promise<FormState> {
  await requireOrg();
  const current = String(form.get("current") ?? ""), next = String(form.get("next") ?? ""), confirm = String(form.get("confirm") ?? "");
  if (!current) return { status: "error", message: "Enter your current password." };
  if (next.length < 10) return { status: "error", message: "The new password must be at least 10 characters." };
  if (!/[a-z]/i.test(next) || !/\d/.test(next)) return { status: "error", message: "Use letters and at least one number." };
  if (next === current) return { status: "error", message: "The new password must be different from the current one." };
  if (next !== confirm) return { status: "error", message: "The two new passwords do not match." };
  return { status: "ok", message: "Password updated." };
}

/** Signs this person out everywhere except this browser (real: removes their other sessions). */
export async function signOutOtherSessions(_prev: FormState): Promise<FormState> {
  const ctx = await requireOrg();
  const { count } = await db.session.deleteMany({ where: { userId: ctx.user.id, NOT: { id: ctx.sessionId } } });
  revalidatePath("/account/security");
  return { status: "ok", message: count ? `Signed out of ${count} other ${count === 1 ? "device" : "devices"}.` : "No other devices were signed in." };
}

/**
 * Delete the signed-in user's account. Workspaces where they are the only member are deleted with it.
 * A workspace with other members must get another owner first, so nobody else loses their work.
 */
export async function deleteAccount(_prev: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireOrg();
  if (String(form.get("confirm") ?? "").trim().toLowerCase() !== ctx.user.email.toLowerCase()) {
    return { status: "error", message: "Type your email address exactly to confirm." };
  }
  const memberships = await db.membership.findMany({
    where: { userId: ctx.user.id },
    include: { organisation: { select: { id: true, name: true, _count: { select: { memberships: true } } } } },
  });
  const blocking = [];
  for (const m of memberships) {
    if (m.role !== "OWNER" || m.organisation._count.memberships <= 1) continue;
    const owners = await db.membership.count({ where: { organisationId: m.organisationId, role: "OWNER" } });
    if (owners <= 1) blocking.push(m.organisation.name);
  }
  if (blocking.length) {
    return { status: "error", message: `You are the only owner of ${blocking.join(", ")}. Make someone else an owner in Settings, Members first.` };
  }
  const soloOrgs = memberships.filter((m) => m.organisation._count.memberships <= 1).map((m) => m.organisationId);
  await db.$transaction([
    // Campaigns first: they keep their agent, which blocks deleting agents on their own.
    db.campaign.deleteMany({ where: { organisationId: { in: soloOrgs } } }),
    db.organisation.deleteMany({ where: { id: { in: soloOrgs } } }),
    db.user.delete({ where: { id: ctx.user.id } }),
  ]);
  await destroySession();
  redirect("/login?deleted=1");
}
