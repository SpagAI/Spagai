import "server-only";
import { db } from "../db";
import { env } from "../env";
import { sendEmail } from "../mailer";
import { defaultOrganisationName } from "./naming";
import { generateToken, hashToken, LOGIN_TOKEN_TTL_MINUTES, normaliseEmail } from "./tokens";

/** Create a one-time login link and email it. */
export async function sendLoginLink(rawEmail: string, opts: { invitedTo?: string } = {}): Promise<void> {
  const email = normaliseEmail(rawEmail);
  const token = generateToken();
  await db.loginToken.create({
    data: { email, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + LOGIN_TOKEN_TTL_MINUTES * 60_000) },
  });
  const link = `${env.APP_URL}/auth/verify?token=${encodeURIComponent(token)}`;
  const intro = opts.invitedTo
    ? `You have been invited to join ${opts.invitedTo} on Spag AI Studio.`
    : "Here is your sign-in link for Spag AI Studio.";
  await sendEmail({
    to: email,
    subject: opts.invitedTo ? `You're invited to ${opts.invitedTo} on Spag AI Studio` : "Your Spag AI Studio sign-in link",
    text: `${intro}\n\nSign in: ${link}\n\nThis link works once and expires in ${LOGIN_TOKEN_TTL_MINUTES} minutes. If you did not ask for it, ignore this email.`,
    html: `<p>${intro}</p><p><a href="${link}">Sign in to Spag AI Studio</a></p><p>This link works once and expires in ${LOGIN_TOKEN_TTL_MINUTES} minutes. If you did not ask for it, ignore this email.</p>`,
  });
}

export type ConsumeResult =
  | { ok: true; userId: string; organisationId: string }
  | { ok: false; reason: "invalid" | "expired" | "used" };

/**
 * Use a login token once. Creates the user on first sign-in, and gives them their own
 * organisation if they do not belong to one yet.
 */
export async function consumeLoginToken(token: string): Promise<ConsumeResult> {
  const record = await db.loginToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record) return { ok: false, reason: "invalid" };
  if (record.usedAt) return { ok: false, reason: "used" };
  if (record.expiresAt < new Date()) return { ok: false, reason: "expired" };

  // Mark used first, guarding against two tabs using the same link at once.
  const marked = await db.loginToken.updateMany({ where: { id: record.id, usedAt: null }, data: { usedAt: new Date() } });
  if (marked.count === 0) return { ok: false, reason: "used" };

  const user = await db.user.upsert({
    where: { email: record.email },
    create: { email: record.email, lastLoginAt: new Date() },
    update: { lastLoginAt: new Date() },
    include: { memberships: { orderBy: { createdAt: "asc" } } },
  });

  let organisationId = user.memberships[0]?.organisationId;
  if (!organisationId) {
    const org = await db.organisation.create({
      data: {
        name: defaultOrganisationName(record.email),
        memberships: { create: { userId: user.id, role: "OWNER" } },
      },
    });
    await db.auditLog.create({
      data: { organisationId: org.id, actorUserId: user.id, action: "organisation.created", targetType: "organisation", targetId: org.id },
    });
    organisationId = org.id;
  }
  return { ok: true, userId: user.id, organisationId };
}
