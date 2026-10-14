/**
 * Who can do what inside an organisation. Pure functions, easy to test.
 *
 * OWNER   everything, including deleting the organisation and managing owners
 * ADMIN   manage members (not owners), agents, campaigns, billing
 * MEMBER  build and edit agents, run campaigns
 * VIEWER  read only
 */

export type Role = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";

export type Permission =
  | "agent:view"
  | "agent:edit"
  | "agent:delete"
  | "member:view"
  | "member:manage"
  | "organisation:edit"
  | "audit:view"
  | "lead:view"
  | "lead:edit"
  | "campaign:run"
  | "call:view"
  | "billing:view"
  | "billing:manage";

const GRANTS: Record<Role, Permission[]> = {
  OWNER: ["agent:view", "agent:edit", "agent:delete", "member:view", "member:manage", "organisation:edit", "audit:view", "lead:view", "lead:edit", "campaign:run", "call:view", "billing:view", "billing:manage"],
  ADMIN: ["agent:view", "agent:edit", "agent:delete", "member:view", "member:manage", "organisation:edit", "audit:view", "lead:view", "lead:edit", "campaign:run", "call:view", "billing:view", "billing:manage"],
  MEMBER: ["agent:view", "agent:edit", "member:view", "lead:view", "lead:edit", "campaign:run", "call:view"],
  VIEWER: ["agent:view", "member:view", "lead:view", "call:view"],
};

export const ROLES: Role[] = ["OWNER", "ADMIN", "MEMBER", "VIEWER"];

export function can(role: Role, permission: Permission): boolean {
  return GRANTS[role].includes(permission);
}

/**
 * Can `actor` give `target` the role `newRole`?
 * Only owners can create or change owners. Nobody can change their own role.
 * The last owner cannot be demoted.
 */
export function canChangeRole(args: {
  actorRole: Role;
  actorIsTarget: boolean;
  targetRole: Role;
  newRole: Role;
  ownerCount: number;
}): { ok: true } | { ok: false; reason: string } {
  const { actorRole, actorIsTarget, targetRole, newRole, ownerCount } = args;
  if (!can(actorRole, "member:manage")) return { ok: false, reason: "You do not have permission to manage members." };
  if (actorIsTarget) return { ok: false, reason: "You cannot change your own role." };
  if ((targetRole === "OWNER" || newRole === "OWNER") && actorRole !== "OWNER") {
    return { ok: false, reason: "Only an owner can add or change owners." };
  }
  if (targetRole === "OWNER" && newRole !== "OWNER" && ownerCount <= 1) {
    return { ok: false, reason: "An organisation must keep at least one owner." };
  }
  return { ok: true };
}

export function canRemoveMember(args: {
  actorRole: Role;
  actorIsTarget: boolean;
  targetRole: Role;
  ownerCount: number;
}): { ok: true } | { ok: false; reason: string } {
  const { actorRole, actorIsTarget, targetRole, ownerCount } = args;
  if (!can(actorRole, "member:manage")) return { ok: false, reason: "You do not have permission to manage members." };
  if (actorIsTarget) return { ok: false, reason: "You cannot remove yourself." };
  if (targetRole === "OWNER" && actorRole !== "OWNER") return { ok: false, reason: "Only an owner can remove an owner." };
  if (targetRole === "OWNER" && ownerCount <= 1) return { ok: false, reason: "An organisation must keep at least one owner." };
  return { ok: true };
}
