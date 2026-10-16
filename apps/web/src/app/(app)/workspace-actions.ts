"use server";

import { revalidatePath } from "next/cache";
import { requireOrg } from "@/server/auth/session";
import { inviteToWorkspace } from "@/server/invites";
import { can } from "@/server/permissions";

export type SwitcherInviteState = { status: "idle" } | { status: "sent"; email: string } | { status: "error"; message: string };

const MESSAGES = {
  invite: "Enter a valid email address and choose a role.",
  "owner-only": "Only an owner can invite another owner.",
  rate: "Too many invites to that address. Try again in a few minutes.",
} as const;

/** Invite from the workspace switcher (stays on the current page and reports the result). */
export async function inviteFromSwitcher(_prev: SwitcherInviteState, form: FormData): Promise<SwitcherInviteState> {
  const ctx = await requireOrg();
  if (!can(ctx.role, "member:manage")) return { status: "error", message: "Only owners and admins can invite members." };
  const result = await inviteToWorkspace(ctx, form.get("email"), form.get("role"));
  if (!result.ok) return { status: "error", message: MESSAGES[result.error] };
  revalidatePath("/settings");
  return { status: "sent", email: result.email };
}
