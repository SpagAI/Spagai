"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { sendLoginLink } from "@/server/auth/login";
import { createSession } from "@/server/auth/session";
import { db } from "@/server/db";
import { normaliseEmail } from "@/server/auth/tokens";
import { loginByEmail, loginByIp } from "@/server/rate-limit";
import { env } from "@/server/env";
import { clientIp } from "@/server/request";

export type LoginState = {
  status: "idle" | "sent" | "invalid" | "rate_limited";
  /** Development shortcut only (DEV_SHOW_LOGIN_LINK=true, never in production). */
  devLink?: string;
};

const schema = z.object({ email: z.string().trim().max(254).email() });

export async function requestLoginLink(_prev: LoginState, form: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({ email: form.get("email") });
  if (!parsed.success) return { status: "invalid" };
  const email = normaliseEmail(parsed.data.email);

  const ip = await clientIp();
  if (!loginByIp.check(ip).allowed || !loginByEmail.check(email).allowed) return { status: "rate_limited" };

  const path = await sendLoginLink(email);
  if (env.DEV_SHOW_LOGIN_LINK && env.NODE_ENV !== "production") return { status: "sent", devLink: path };
  // Same answer whether or not the address has an account, so emails cannot be discovered.
  return { status: "sent" };
}

/** The sample account visitors use on a demo site (created by prisma/seed.ts). */
const DEMO_EMAIL = "demo@spagai.local";

/** Demo sites only (DEMO_MODE=true): sign in to the sample workspace without an email link. */
export async function demoSignIn(): Promise<void> {
  if (!env.DEMO_MODE) redirect("/login");
  if (!loginByIp.check(await clientIp()).allowed) redirect("/login?error=rate-limited");
  const user = await db.user.findUnique({
    where: { email: DEMO_EMAIL },
    include: { memberships: { orderBy: { createdAt: "asc" }, take: 1 } },
  });
  const organisationId = user?.memberships[0]?.organisationId;
  if (!user || !organisationId) redirect("/login?error=no-demo");
  await createSession(user.id, organisationId);
  redirect("/home");
}
