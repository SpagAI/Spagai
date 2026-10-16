"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { availableNumbers, formatNumber, NUMBER_COUNTRIES } from "@/lib/numbers";
import { audit } from "@/server/agents";
import { requirePermission } from "@/server/auth/session";
import { db } from "@/server/db";

export type NumberFormState = { status: "idle" } | { status: "ok"; message: string } | { status: "error"; message: string };

const BuySchema = z.object({
  number: z.string().regex(/^\+\d{8,15}$/),
  countryCode: z.string().length(2),
  areaCode: z.string().min(1).max(5),
  seed: z.coerce.number().int().min(0).max(20),
  label: z.string().trim().max(60).catch(""),
  agentId: z.string().catch(""),
});

export async function buyNumber(_prev: NumberFormState, form: FormData): Promise<NumberFormState> {
  const ctx = await requirePermission("number:manage");
  const parsed = BuySchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { status: "error", message: "That number is no longer available. Search again." };
  const { number, countryCode, areaCode, seed, label, agentId } = parsed.data;
  // Only numbers from the search results can be bought, at the catalogue price.
  const offer = availableNumbers(countryCode, areaCode, seed).find((n) => n.number === number);
  const country = NUMBER_COUNTRIES.find((c) => c.code === countryCode);
  if (!offer || !country) return { status: "error", message: "That number is no longer available. Search again." };
  if (await db.phoneNumber.findFirst({ where: { number, status: "ACTIVE" } })) return { status: "error", message: "Someone has just bought that number. Choose another one." };
  const agent = agentId ? await db.agent.findFirst({ where: { id: agentId, organisationId: ctx.organisation.id }, select: { id: true } }) : null;

  const created = await db.phoneNumber.create({
    data: {
      organisationId: ctx.organisation.id, number, countryCode, country: country.name, areaCode, type: offer.type,
      monthlyCostKobo: offer.monthlyNaira * 100, label, agentId: agent?.id ?? null,
    },
  });
  await audit(ctx.organisation.id, ctx.user.id, "number.bought", { type: "phoneNumber", id: created.id }, { number });
  revalidatePath("/numbers");
  return { status: "ok", message: `${formatNumber(number)} is now yours.` };
}

export async function assignAgent(form: FormData): Promise<void> {
  const ctx = await requirePermission("number:manage");
  const id = z.string().min(1).parse(form.get("id"));
  const agentId = z.string().parse(form.get("agentId") ?? "");
  const agent = agentId ? await db.agent.findFirst({ where: { id: agentId, organisationId: ctx.organisation.id }, select: { id: true } }) : null;
  await db.phoneNumber.updateMany({ where: { id, organisationId: ctx.organisation.id, status: "ACTIVE" }, data: { agentId: agent?.id ?? null } });
  revalidatePath("/numbers");
  revalidatePath("/agents/[id]", "page");
}

export async function releaseNumber(form: FormData): Promise<void> {
  const ctx = await requirePermission("number:manage");
  const id = z.string().min(1).parse(form.get("id"));
  const { count } = await db.phoneNumber.updateMany({
    where: { id, organisationId: ctx.organisation.id, status: "ACTIVE" },
    data: { status: "RELEASED", releasedAt: new Date(), agentId: null },
  });
  if (count) await audit(ctx.organisation.id, ctx.user.id, "number.released", { type: "phoneNumber", id });
  revalidatePath("/numbers");
}

const TrunkSchema = z.object({
  name: z.string().trim().min(2).max(60),
  host: z.string().trim().min(3).max(120).regex(/^[a-zA-Z0-9.-]+$/, "host"),
  port: z.coerce.number().int().min(1).max(65535),
  transport: z.enum(["udp", "tcp", "tls"]),
  username: z.string().trim().max(80).catch(""),
  numbers: z.string().max(2000).catch(""),
});

export async function addSipTrunk(_prev: NumberFormState, form: FormData): Promise<NumberFormState> {
  const ctx = await requirePermission("number:manage");
  const parsed = TrunkSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return { status: "error", message: field === "host" ? "Enter the SIP server address, e.g. sip.mycarrier.com." : field === "port" ? "The port must be a number between 1 and 65535." : "Give the trunk a name of at least 2 characters." };
  }
  const { numbers: rawNumbers, ...trunk } = parsed.data;
  const numbers = rawNumbers.split(/[\s,;]+/).map((n) => n.replace(/[^\d+]/g, "")).filter(Boolean);
  const bad = numbers.find((n) => !/^\+\d{8,15}$/.test(n));
  if (bad) return { status: "error", message: `"${bad}" is not a full international number. Start it with + and the country code.` };

  // Prototype: we only record that a password was given. It is never stored.
  const created = await db.sipTrunk.create({ data: { organisationId: ctx.organisation.id, ...trunk, hasPassword: String(form.get("password") ?? "").length > 0 } });
  for (const number of numbers) {
    const country = NUMBER_COUNTRIES.filter((c) => number.startsWith(c.dial)).sort((a, b) => b.dial.length - a.dial.length)[0];
    await db.phoneNumber.create({
      data: { organisationId: ctx.organisation.id, number, countryCode: country?.code ?? "", country: country?.name ?? "Other", type: "local", source: trunk.name },
    });
  }
  await audit(ctx.organisation.id, ctx.user.id, "sip_trunk.added", { type: "sipTrunk", id: created.id }, { host: trunk.host, numbers: numbers.length });
  revalidatePath("/numbers");
  return { status: "ok", message: `${trunk.name} is connected${numbers.length ? ` with ${numbers.length} number${numbers.length === 1 ? "" : "s"}` : ""}.` };
}

export async function removeSipTrunk(form: FormData): Promise<void> {
  const ctx = await requirePermission("number:manage");
  const id = z.string().min(1).parse(form.get("id"));
  const trunk = await db.sipTrunk.findFirst({ where: { id, organisationId: ctx.organisation.id } });
  if (!trunk) return;
  await db.$transaction([
    db.phoneNumber.updateMany({ where: { organisationId: ctx.organisation.id, source: trunk.name, status: "ACTIVE" }, data: { status: "RELEASED", releasedAt: new Date(), agentId: null } }),
    db.sipTrunk.delete({ where: { id } }),
  ]);
  await audit(ctx.organisation.id, ctx.user.id, "sip_trunk.removed", { type: "sipTrunk", id });
  revalidatePath("/numbers");
}
