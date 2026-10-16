"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { INTEGRATIONS } from "@/lib/integrations";
import { audit } from "@/server/agents";
import { requirePermission } from "@/server/auth/session";
import { db } from "@/server/db";

export type ConnectState = { status: "idle" } | { status: "ok"; message: string } | { status: "error"; message: string };

export async function connectIntegration(_prev: ConnectState, form: FormData): Promise<ConnectState> {
  const ctx = await requirePermission("integration:manage");
  const info = INTEGRATIONS.find((i) => i.id === form.get("provider"));
  if (!info) return { status: "error", message: "Unknown integration." };
  let detail = z.string().trim().max(300).catch("").parse(form.get("detail"));

  if (info.field) {
    if (!detail) return { status: "error", message: `Enter your ${info.field.label.toLowerCase()}.` };
    if (info.field.type === "url") {
      try {
        const url = new URL(detail);
        if (url.protocol !== "https:") return { status: "error", message: "The address must start with https://." };
      } catch {
        return { status: "error", message: "Enter a full address, starting with https://." };
      }
    }
    if (info.id === "slack" && !detail.startsWith("#")) detail = `#${detail}`;
  } else {
    // One-click sign-in (simulated): show which account was connected.
    detail = `${ctx.organisation.name} · ${info.demoAccount ?? "account"}`;
  }

  await db.integration.upsert({
    where: { organisationId_provider: { organisationId: ctx.organisation.id, provider: info.id } },
    create: { organisationId: ctx.organisation.id, provider: info.id, detail },
    update: { detail, connectedAt: new Date() },
  });
  await audit(ctx.organisation.id, ctx.user.id, "integration.connected", { type: "integration", id: info.id });
  revalidatePath("/integrations");
  return { status: "ok", message: `${info.name} is connected.` };
}

export async function disconnectIntegration(form: FormData): Promise<void> {
  const ctx = await requirePermission("integration:manage");
  const provider = z.string().min(1).parse(form.get("provider"));
  const { count } = await db.integration.deleteMany({ where: { organisationId: ctx.organisation.id, provider } });
  if (count) await audit(ctx.organisation.id, ctx.user.id, "integration.disconnected", { type: "integration", id: provider });
  revalidatePath("/integrations");
}

/** Pretend to send a test event, so people can see what arrives. */
export async function sendTestEvent(provider: string): Promise<{ ok: boolean; message: string }> {
  const ctx = await requirePermission("integration:manage");
  const found = await db.integration.findFirst({ where: { organisationId: ctx.organisation.id, provider } });
  if (!found) return { ok: false, message: "Connect it first." };
  await new Promise((r) => setTimeout(r, 700));
  return { ok: true, message: `Test event sent · 200 OK in ${180 + (provider.length * 37) % 220} ms` };
}
