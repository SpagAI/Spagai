import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "../db";
import { env } from "../env";
import { can, type Permission, type Role } from "../permissions";
import { generateToken, hashToken, SESSION_TTL_DAYS } from "./tokens";

export const SESSION_COOKIE = "spag_session";

export async function createSession(userId: string, activeOrganisationId: string | null): Promise<void> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  await db.session.create({ data: { tokenHash: hashToken(token), userId, activeOrganisationId, expiresAt } });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  jar.delete(SESSION_COOKIE);
}

/** The signed-in user and their session, or null. Cached for one request. */
export const getSession = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
  if (!session || session.expiresAt < new Date()) return null;
  return session;
});

export interface OrgContext {
  sessionId: string;
  user: { id: string; email: string; name: string | null };
  organisation: { id: string; name: string };
  role: Role;
  memberships: { organisationId: string; organisationName: string; role: Role }[];
}

/**
 * Use at the top of every signed-in page or action.
 * Sends the visitor to /login if they are not signed in.
 */
export const requireOrg = cache(async (): Promise<OrgContext> => {
  const session = await getSession();
  if (!session) redirect("/login");

  const memberships = await db.membership.findMany({
    where: { userId: session.userId },
    include: { organisation: true },
    orderBy: { createdAt: "asc" },
  });
  if (memberships.length === 0) redirect("/login?error=no-organisation");

  const active = memberships.find((m) => m.organisationId === session.activeOrganisationId) ?? memberships[0]!;
  return {
    sessionId: session.id,
    user: { id: session.user.id, email: session.user.email, name: session.user.name },
    organisation: { id: active.organisation.id, name: active.organisation.name },
    role: active.role,
    memberships: memberships.map((m) => ({ organisationId: m.organisationId, organisationName: m.organisation.name, role: m.role })),
  };
});

export class ForbiddenError extends Error {}

/** Throws when the current member lacks a permission. */
export async function requirePermission(permission: Permission): Promise<OrgContext> {
  const ctx = await requireOrg();
  if (!can(ctx.role, permission)) throw new ForbiddenError(`Your role (${ctx.role}) cannot do this.`);
  return ctx;
}
