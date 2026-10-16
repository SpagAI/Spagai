"use server";

import { z } from "zod";
import { requireOrg } from "@/server/auth/session";
import { audit } from "@/server/agents";

export type TicketState = { status: "idle" } | { status: "ok"; ticket: string } | { status: "error"; message: string };

/** Prototype: the request is recorded in the activity log and given a ticket number; no email is sent yet. */
export async function contactSupport(_prev: TicketState, form: FormData): Promise<TicketState> {
  const ctx = await requireOrg();
  const parsed = z
    .object({ topic: z.enum(["calls", "billing", "agents", "numbers", "account", "other"]), subject: z.string().trim().min(3).max(120), message: z.string().trim().min(10).max(4000) })
    .safeParse({ topic: form.get("topic"), subject: form.get("subject"), message: form.get("message") });
  if (!parsed.success) return { status: "error", message: "Add a subject and a message of at least 10 characters." };
  const ticket = `SPG-${(Date.now() % 100000).toString().padStart(5, "0")}`;
  await audit(ctx.organisation.id, ctx.user.id, "support.requested", undefined, { ticket, topic: parsed.data.topic, subject: parsed.data.subject });
  return { status: "ok", ticket };
}
