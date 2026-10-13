"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isLocale, LOCALE_COOKIE } from "@/i18n";
import { cookies } from "next/headers";
import { db } from "@/server/db";
import { destroySession, requireOrg } from "@/server/auth/session";

export async function signOut(): Promise<void> {
  await destroySession();
  redirect("/login");
}

export async function switchOrganisation(form: FormData): Promise<void> {
  const ctx = await requireOrg();
  const organisationId = z.string().min(1).parse(form.get("organisationId"));
  if (!ctx.memberships.some((m) => m.organisationId === organisationId)) throw new Error("Not a member of that organisation.");
  await db.session.update({ where: { id: ctx.sessionId }, data: { activeOrganisationId: organisationId } });
  redirect("/dashboard");
}

export async function setLocale(form: FormData): Promise<void> {
  const value = String(form.get("locale") ?? "");
  if (isLocale(value)) (await cookies()).set(LOCALE_COOKIE, value, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
}
