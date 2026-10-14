import { describe, expect, it } from "vitest";
import { can, canChangeRole, canRemoveMember } from "@/server/permissions";

describe("can", () => {
  it("gives viewers read-only access", () => {
    expect(can("VIEWER", "agent:view")).toBe(true);
    expect(can("VIEWER", "agent:edit")).toBe(false);
    expect(can("VIEWER", "lead:view")).toBe(true);
    expect(can("VIEWER", "call:view")).toBe(true);
    expect(can("VIEWER", "lead:edit")).toBe(false);
    expect(can("VIEWER", "campaign:run")).toBe(false);
    expect(can("MEMBER", "lead:edit")).toBe(true);
    expect(can("MEMBER", "campaign:run")).toBe(true);
    expect(can("MEMBER", "billing:view")).toBe(false);
    expect(can("ADMIN", "billing:manage")).toBe(true);
  });

  it("lets members edit agents but not manage people", () => {
    expect(can("MEMBER", "agent:edit")).toBe(true);
    expect(can("MEMBER", "agent:delete")).toBe(false);
    expect(can("MEMBER", "member:manage")).toBe(false);
  });

  it("lets admins and owners manage members", () => {
    expect(can("ADMIN", "member:manage")).toBe(true);
    expect(can("OWNER", "member:manage")).toBe(true);
  });
});

describe("canChangeRole", () => {
  const base = { actorRole: "OWNER" as const, actorIsTarget: false, targetRole: "MEMBER" as const, newRole: "ADMIN" as const, ownerCount: 1 };

  it("allows an owner to promote a member", () => {
    expect(canChangeRole(base).ok).toBe(true);
  });

  it("blocks admins from creating or touching owners", () => {
    expect(canChangeRole({ ...base, actorRole: "ADMIN", newRole: "OWNER" }).ok).toBe(false);
    expect(canChangeRole({ ...base, actorRole: "ADMIN", targetRole: "OWNER", newRole: "MEMBER", ownerCount: 2 }).ok).toBe(false);
  });

  it("blocks changing your own role and demoting the last owner", () => {
    expect(canChangeRole({ ...base, actorIsTarget: true }).ok).toBe(false);
    const r = canChangeRole({ ...base, targetRole: "OWNER", newRole: "ADMIN", ownerCount: 1 });
    expect(r).toEqual({ ok: false, reason: "An organisation must keep at least one owner." });
    expect(canChangeRole({ ...base, targetRole: "OWNER", newRole: "ADMIN", ownerCount: 2 }).ok).toBe(true);
  });

  it("blocks members and viewers", () => {
    expect(canChangeRole({ ...base, actorRole: "MEMBER" }).ok).toBe(false);
  });
});

describe("canRemoveMember", () => {
  it("follows the same owner rules", () => {
    expect(canRemoveMember({ actorRole: "ADMIN", actorIsTarget: false, targetRole: "MEMBER", ownerCount: 1 }).ok).toBe(true);
    expect(canRemoveMember({ actorRole: "ADMIN", actorIsTarget: false, targetRole: "OWNER", ownerCount: 2 }).ok).toBe(false);
    expect(canRemoveMember({ actorRole: "OWNER", actorIsTarget: false, targetRole: "OWNER", ownerCount: 1 }).ok).toBe(false);
    expect(canRemoveMember({ actorRole: "OWNER", actorIsTarget: true, targetRole: "OWNER", ownerCount: 2 }).ok).toBe(false);
  });
});
