"use server";

import { parseLeadCsv, parseNigerianPhone, type LeadImportResult } from "@spagai/core";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/server/auth/session";
import { audit } from "@/server/agents";
import { db } from "@/server/db";

const MAX_FILE_BYTES = 2 * 1024 * 1024;

export type ImportState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | {
      status: "done";
      created: number;
      updated: number;
      duplicates: number;
      errors: LeadImportResult["errors"];
      blockedColumns: string[];
    };

export async function importLeads(_prev: ImportState, form: FormData): Promise<ImportState> {
  const ctx = await requirePermission("lead:edit");
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { status: "error", message: "Choose a CSV file first." };
  if (file.size > MAX_FILE_BYTES) return { status: "error", message: "The file is larger than 2 MB. Split it into smaller files." };

  const defaultSource = z.string().trim().max(120).catch("").parse(form.get("source"));
  const defaultConsent = form.get("consent") === "on";
  const parsed = parseLeadCsv(await file.text(), { defaultSource, defaultConsent });

  let created = 0;
  let updated = 0;
  const existing = new Set(
    (
      await db.lead.findMany({
        where: { organisationId: ctx.organisation.id, phone: { in: parsed.leads.map((l) => l.phone) } },
        select: { phone: true },
      })
    ).map((l) => l.phone),
  );
  for (const lead of parsed.leads) {
    // Re-importing a number updates its details. It never clears an opt-out.
    const data = {
      firstName: lead.firstName,
      lastName: lead.lastName,
      title: lead.title,
      gender: lead.gender,
      email: lead.email,
      source: lead.source,
      consent: lead.consent,
      extra: lead.extra,
    };
    await db.lead.upsert({
      where: { organisationId_phone: { organisationId: ctx.organisation.id, phone: lead.phone } },
      create: { organisationId: ctx.organisation.id, phone: lead.phone, ...data },
      update: data,
    });
    if (existing.has(lead.phone)) updated++;
    else created++;
  }

  await audit(ctx.organisation.id, ctx.user.id, "leads.imported", undefined, {
    file: file.name.slice(0, 120),
    created,
    updated,
    rejectedRows: parsed.errors.length,
    blockedColumns: parsed.blockedColumns,
  });
  revalidatePath("/leads");
  return { status: "done", created, updated, duplicates: parsed.duplicates, errors: parsed.errors.slice(0, 50), blockedColumns: parsed.blockedColumns };
}

const back = (query: string) => redirect(`/leads?${query}`);

export async function addLead(form: FormData): Promise<void> {
  const ctx = await requirePermission("lead:edit");
  const input = z
    .object({
      firstName: z.string().trim().min(1).max(60),
      lastName: z.string().trim().max(60),
      title: z.string().trim().max(20),
      gender: z.enum(["male", "female", ""]),
      phone: z.string().trim().min(1).max(30),
      source: z.string().trim().min(1).max(120),
    })
    .safeParse(Object.fromEntries(["firstName", "lastName", "title", "gender", "phone", "source"].map((k) => [k, form.get(k) ?? ""])));
  if (!input.success) return back("error=lead");
  const phone = parseNigerianPhone(input.data.phone);
  if (!phone.valid) return back(`error=phone&reason=${encodeURIComponent(phone.reason ?? "")}`);

  const { phone: _raw, ...details } = input.data;
  const consent = form.get("consent") === "on";
  const lead = await db.lead.upsert({
    where: { organisationId_phone: { organisationId: ctx.organisation.id, phone: phone.e164! } },
    create: { organisationId: ctx.organisation.id, phone: phone.e164!, consent, ...details },
    update: { consent, ...details },
  });
  await audit(ctx.organisation.id, ctx.user.id, "lead.saved", { type: "lead", id: lead.id });
  revalidatePath("/leads");
  back("saved=1");
}

/** Mark a person as opted out and put their number on the do-not-call list. Cannot be undone from the app. */
export async function optOutLead(form: FormData): Promise<void> {
  const ctx = await requirePermission("lead:edit");
  const leadId = z.string().min(1).parse(form.get("leadId"));
  const lead = await db.lead.findFirst({ where: { id: leadId, organisationId: ctx.organisation.id } });
  if (!lead) return back("error=not-found");
  await db.$transaction([
    db.lead.update({ where: { id: lead.id }, data: { optedOut: true, optedOutAt: new Date() } }),
    db.doNotCall.upsert({
      where: { organisationId_phone: { organisationId: ctx.organisation.id, phone: lead.phone } },
      create: { organisationId: ctx.organisation.id, phone: lead.phone, reason: "manual", note: `Opted out by ${ctx.user.email}.` },
      update: {},
    }),
  ]);
  await audit(ctx.organisation.id, ctx.user.id, "lead.opted_out", { type: "lead", id: lead.id }, { by: "team member" });
  revalidatePath("/leads");
  back("optedOut=1");
}

export async function addDoNotCall(form: FormData): Promise<void> {
  const ctx = await requirePermission("lead:edit");
  const phone = parseNigerianPhone(z.string().max(30).catch("").parse(form.get("phone")));
  if (!phone.valid) return back(`error=phone&reason=${encodeURIComponent(phone.reason ?? "")}`);
  const note = z.string().trim().max(200).catch("").parse(form.get("note"));
  await db.$transaction([
    db.doNotCall.upsert({
      where: { organisationId_phone: { organisationId: ctx.organisation.id, phone: phone.e164! } },
      create: { organisationId: ctx.organisation.id, phone: phone.e164!, reason: "manual", note },
      update: {},
    }),
    db.lead.updateMany({ where: { organisationId: ctx.organisation.id, phone: phone.e164!, optedOut: false }, data: { optedOut: true, optedOutAt: new Date() } }),
  ]);
  await audit(ctx.organisation.id, ctx.user.id, "dnc.added", undefined, { phone: phone.e164 });
  revalidatePath("/leads");
  back("dnc=1");
}
