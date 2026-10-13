"use server";

import { redirect } from "next/navigation";
import { consumeLoginToken } from "@/server/auth/login";
import { createSession } from "@/server/auth/session";

export async function completeLogin(form: FormData): Promise<void> {
  const token = String(form.get("token") ?? "");
  const result = token ? await consumeLoginToken(token) : ({ ok: false, reason: "invalid" } as const);
  if (!result.ok) redirect(`/auth/verify?error=${result.reason}`);
  await createSession(result.userId, result.organisationId);
  redirect("/dashboard");
}
