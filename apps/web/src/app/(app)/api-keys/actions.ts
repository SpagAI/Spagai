"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/server/agents";
import { decryptApiKey, displayPrefix, encryptApiKey, generateApiKey, hashApiKey } from "@/server/api-key-crypto";
import { requirePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { env } from "@/server/env";

export type CreateKeyState = { status: "idle" } | { status: "error"; message: string } | { status: "created"; id: string; name: string; key: string };

const MAX_KEYS = 20;

export async function createApiKey(_prev: CreateKeyState, form: FormData): Promise<CreateKeyState> {
  const ctx = await requirePermission("apikey:manage");
  const name = z.string().trim().min(2).max(60).safeParse(form.get("name"));
  if (!name.success) return { status: "error", message: "Give the key a name of at least 2 characters, e.g. “Website form”." };
  if ((await db.apiKey.count({ where: { organisationId: ctx.organisation.id } })) >= MAX_KEYS) {
    return { status: "error", message: `You can have up to ${MAX_KEYS} keys. Delete one you no longer use first.` };
  }
  const key = generateApiKey();
  const created = await db.apiKey.create({
    data: {
      organisationId: ctx.organisation.id, name: name.data, prefix: displayPrefix(key), keyHash: hashApiKey(key),
      keyEncrypted: encryptApiKey(key, env.SESSION_SECRET), createdById: ctx.user.id,
    },
  });
  await audit(ctx.organisation.id, ctx.user.id, "api_key.created", { type: "apiKey", id: created.id }, { name: name.data });
  revalidatePath("/api-keys");
  return { status: "created", id: created.id, name: name.data, key };
}

/** Show a key again (owners and admins only). */
export async function revealApiKey(id: string): Promise<{ key: string } | { error: string }> {
  const ctx = await requirePermission("apikey:manage");
  const found = await db.apiKey.findFirst({ where: { id: z.string().min(1).parse(id), organisationId: ctx.organisation.id } });
  if (!found) return { error: "That key no longer exists." };
  try {
    const key = decryptApiKey(found.keyEncrypted, env.SESSION_SECRET);
    await audit(ctx.organisation.id, ctx.user.id, "api_key.revealed", { type: "apiKey", id: found.id });
    return { key };
  } catch {
    return { error: "This key cannot be shown. Create a new one instead." };
  }
}

export async function deleteApiKey(form: FormData): Promise<void> {
  const ctx = await requirePermission("apikey:manage");
  const id = z.string().min(1).parse(form.get("id"));
  const { count } = await db.apiKey.deleteMany({ where: { id, organisationId: ctx.organisation.id } });
  if (count) await audit(ctx.organisation.id, ctx.user.id, "api_key.deleted", { type: "apiKey", id });
  revalidatePath("/api-keys");
}
