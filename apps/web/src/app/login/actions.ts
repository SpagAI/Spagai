"use server";

import { z } from "zod";
import { sendLoginLink } from "@/server/auth/login";
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
