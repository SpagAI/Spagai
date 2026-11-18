"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { availableNumbers, formatNumber, NUMBER_COUNTRIES } from "@/lib/numbers";
import { audit } from "@/server/agents";
import { requirePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { cleanSipHost, parseTrunkNumbers } from "@/lib/sip-providers";
import { encryptSecret } from "@/server/custom-tools";
import { getTelephony } from "@/server/telephony";

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
  provider: z.enum(["africas_talking", "twilio", "vonage", "telnyx", "plivo", "other"]).catch("other"),
  name: z.string().trim().min(2).max(60),
  host: z.string().max(200).transform(cleanSipHost).pipe(z.string().min(3).max(120).regex(/^[a-z0-9.-]+$/, "host")),
  port: z.coerce.number().int().min(1).max(65535),
  transport: z.enum(["udp", "tcp", "tls"]),
  direction: z.enum(["both", "inbound", "outbound"]).catch("both"),
  authMode: z.enum(["credentials", "ip"]).catch("credentials"),
  username: z.string().trim().max(80).catch(""),
  numbers: z.string().max(2000).catch(""),
});

/**
 * Save a SIP trunk and its numbers. The password is stored encrypted. Until the phone system is
 * connected, the trunk is "saved" (not live); see src/server/telephony.ts.
 */
export async function addSipTrunk(_prev: NumberFormState, form: FormData): Promise<NumberFormState> {
  const ctx = await requirePermission("number:manage");
  const parsed = TrunkSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return { status: "error", message: field === "host" ? "Enter the SIP server address, e.g. sip.yourprovider.com." : field === "port" ? "The port must be a number between 1 and 65535." : "Give the trunk a name of at least 2 characters." };
  }
  const { numbers: rawNumbers, ...trunk } = parsed.data;
  const { numbers, bad } = parseTrunkNumbers(rawNumbers);
  if (bad) return { status: "error", message: `"${bad}" is not a full international number. Start it with + and the country code, e.g. +2349012345678.` };
  const password = String(form.get("password") ?? "");
  if (trunk.authMode === "credentials" && (!trunk.username || !password)) return { status: "error", message: "Enter the SIP username and password from your provider, or choose “My provider trusts your addresses”." };
  const taken = await db.phoneNumber.findMany({ where: { organisationId: ctx.organisation.id, status: "ACTIVE", number: { in: numbers } }, select: { number: true } });
  if (taken.length) return { status: "error", message: `${formatNumber(taken[0]!.number)} is already in your numbers.` };

  const created = await db.sipTrunk.create({
    data: {
      organisationId: ctx.organisation.id, ...trunk,
      hasPassword: password.length > 0, passwordEncrypted: password ? encryptSecret(password) : "", status: "saved",
    },
  });
  for (const number of numbers) {
    const country = NUMBER_COUNTRIES.filter((c) => number.startsWith(c.dial)).sort((x, y) => y.dial.length - x.dial.length)[0];
    await db.phoneNumber.create({
      data: {
        organisationId: ctx.organisation.id, number, countryCode: country?.code ?? "", country: country?.name ?? "Other", type: "local", source: trunk.name,
        inboundEnabled: trunk.direction !== "outbound", outboundEnabled: trunk.direction !== "inbound",
      },
    });
  }
  const registered = await getTelephony().registerTrunk({ id: created.id, host: trunk.host, port: trunk.port, transport: trunk.transport, username: trunk.username, password, numbers });
  if (registered.ok) await db.sipTrunk.update({ where: { id: created.id }, data: { status: "connected" } });
  await audit(ctx.organisation.id, ctx.user.id, "sip_trunk.added", { type: "sipTrunk", id: created.id }, { provider: trunk.provider, host: trunk.host, numbers: numbers.length });
  revalidatePath("/numbers");
  return { status: "ok", message: `${trunk.name} is saved${numbers.length ? ` with ${numbers.length} number${numbers.length === 1 ? "" : "s"}` : ""}. ${registered.message}` };
}

/** Choose whether an agent answers calls on a number, makes calls from it, or both. */
export async function setNumberDirections(id: string, inbound: boolean, outbound: boolean): Promise<void> {
  const ctx = await requirePermission("number:manage");
  await db.phoneNumber.updateMany({ where: { id: z.string().min(1).parse(id), organisationId: ctx.organisation.id }, data: { inboundEnabled: inbound, outboundEnabled: outbound } });
  revalidatePath("/numbers");
}

export type TestCallResult = { ok: boolean; message: string };

/** "Call my phone": ring the person's phone and connect it to the agent (needs the phone system). */
export async function placeTestCall(agentId: string, toNumber: string): Promise<TestCallResult> {
  const ctx = await requirePermission("agent:edit");
  const to = toNumber.replace(/[^\d+]/g, "");
  if (!/^\+\d{8,15}$/.test(to)) return { ok: false, message: "Enter your number in international format, e.g. +2348031234567." };
  const from = await db.phoneNumber.findFirst({ where: { organisationId: ctx.organisation.id, agentId: z.string().min(1).parse(agentId), status: "ACTIVE", outboundEnabled: true } });
  if (!from) return { ok: false, message: "Give this agent a number that can make calls first." };
  return getTelephony().placeCall({ agentId, fromNumber: from.number, toNumber: to });
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
