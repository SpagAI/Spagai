import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { initialsOf } from "@/lib/shell-types";
import { requireOrg } from "@/server/auth/session";
import { db } from "@/server/db";
import { DeleteAccount, NotificationsForm, ProfileForm } from "./forms";

export const metadata: Metadata = { title: "Your profile" };

export default async function AccountPage() {
  const ctx = await requireOrg();
  const [user, memberships] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: ctx.user.id } }),
    db.membership.findMany({ where: { userId: ctx.user.id }, include: { organisation: { select: { name: true, _count: { select: { memberships: true } } } } } }),
  ]);
  const soloWorkspaces = memberships.filter((m) => m.organisation._count.memberships <= 1).map((m) => m.organisation.name);
  const prefs = (user.notificationPrefs && typeof user.notificationPrefs === "object" && !Array.isArray(user.notificationPrefs) ? user.notificationPrefs : {}) as Record<string, boolean>;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <span aria-hidden="true" className="flex size-14 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground">{initialsOf(user.name, user.email)}</span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{user.name || "Your profile"}</h1>
          <p className="text-sm text-muted-foreground">{user.email}{user.jobTitle && ` · ${user.jobTitle}`}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile details</CardTitle>
          <CardDescription>How your name appears to your team and in the activity log.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm name={user.name ?? ""} jobTitle={user.jobTitle} phone={user.phone} email={user.email} />
        </CardContent>
      </Card>

      <Card id="notifications" className="scroll-mt-24">
        <CardHeader>
          <CardTitle>Notification preferences</CardTitle>
          <CardDescription>Choose which emails you get. In-app notifications (the bell) always show.</CardDescription>
        </CardHeader>
        <CardContent>
          <NotificationsForm prefs={prefs} />
        </CardContent>
      </Card>

      <Card id="danger" className="scroll-mt-24 border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Danger zone</CardTitle>
          <CardDescription>Delete your account and sign out everywhere. This cannot be undone.</CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteAccount email={user.email} soloWorkspaces={soloWorkspaces} />
        </CardContent>
      </Card>
    </div>
  );
}
