import type { Metadata } from "next";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { LOCALES } from "@/i18n";
import { getLocale, getT } from "@/i18n/server";
import { formatLagos } from "@/lib/format";
import { requireOrg } from "@/server/auth/session";
import { db } from "@/server/db";
import { can, ROLES } from "@/server/permissions";
import { setLocale } from "../actions";
import { changeRole, inviteMember, removeMember, renameOrganisation } from "./actions";

export const metadata: Metadata = { title: "Settings" };

const ERRORS: Record<string, string> = {
  name: "Organisation name must be 2 to 80 characters.",
  invite: "Enter a valid email address and role.",
  "owner-only": "Only an owner can invite another owner.",
  rate: "Too many invites to that address. Try again later.",
  "not-found": "Member not found.",
};

export default async function SettingsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const ctx = await requireOrg();
  const t = await getT();
  const locale = await getLocale();
  const canManage = can(ctx.role, "member:manage");
  const canEditOrg = can(ctx.role, "organisation:edit");

  const [org, members, logs] = await Promise.all([
    db.organisation.findUniqueOrThrow({ where: { id: ctx.organisation.id } }),
    db.membership.findMany({ where: { organisationId: ctx.organisation.id }, include: { user: true }, orderBy: { createdAt: "asc" } }),
    can(ctx.role, "audit:view")
      ? db.auditLog.findMany({ where: { organisationId: ctx.organisation.id }, orderBy: { createdAt: "desc" }, take: 15 })
      : Promise.resolve([]),
  ]);
  const error = params.error ? (ERRORS[params.error] ?? params.error) : null;

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("settings.title")}</h1>
      {error && <Alert variant="destructive">{error}</Alert>}
      {params.invited && <Alert variant="success">{t("settings.invited")}</Alert>}

      <Card id="workspace" className="scroll-mt-24">
        <CardHeader>
          <CardTitle>{t("settings.name")}</CardTitle>
          <CardDescription>{t("settings.timezone")}: {org.timezone} · {t("settings.currency")}: {org.currency} (₦)</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={renameOrganisation} className="flex flex-col gap-2 sm:flex-row">
            <Input name="name" defaultValue={org.name} disabled={!canEditOrg} aria-label={t("settings.name")} required minLength={2} maxLength={80} />
            {canEditOrg && <Button type="submit">{t("settings.save")}</Button>}
          </form>
        </CardContent>
      </Card>

      <Card id="members" className="scroll-mt-24">
        <CardHeader>
          <CardTitle>{t("settings.members")}</CardTitle>
          <CardDescription>{t("settings.roleHelp")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="divide-y rounded-md border">
            {members.map((m) => {
              const isMe = m.userId === ctx.user.id;
              return (
                <li key={m.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">
                    {m.user.email} {isMe && <span className="text-muted-foreground">({t("settings.you")})</span>}
                  </span>
                  {canManage && !isMe ? (
                    <>
                      <form action={changeRole} className="flex items-center gap-1">
                        <input type="hidden" name="membershipId" value={m.id} />
                        <Select name="role" defaultValue={m.role} className="h-8 w-28" aria-label={t("settings.inviteRole")}>
                          {ROLES.map((r) => <option key={r} value={r}>{t(`settings.roles.${r}`)}</option>)}
                        </Select>
                        <Button type="submit" size="sm" variant="outline">{t("settings.save")}</Button>
                      </form>
                      <form action={removeMember}>
                        <input type="hidden" name="membershipId" value={m.id} />
                        <Button type="submit" size="sm" variant="ghost" className="text-destructive">{t("settings.remove")}</Button>
                      </form>
                    </>
                  ) : (
                    <Badge variant="secondary">{t(`settings.roles.${m.role}`)}</Badge>
                  )}
                </li>
              );
            })}
          </ul>

          {canManage && (
            <form action={inviteMember} className="grid gap-2 sm:grid-cols-[1fr_9rem_auto] sm:items-end">
              <div className="space-y-1.5">
                <Label htmlFor="invite-email">{t("settings.invite")}</Label>
                <Input id="invite-email" name="email" type="email" required placeholder="colleague@company.com" />
              </div>
              <Select name="role" defaultValue="MEMBER" aria-label={t("settings.inviteRole")}>
                {ROLES.filter((r) => r !== "OWNER" || ctx.role === "OWNER").map((r) => (
                  <option key={r} value={r}>{t(`settings.roles.${r}`)}</option>
                ))}
              </Select>
              <Button type="submit">{t("settings.inviteSubmit")}</Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.language")}</CardTitle>
          <CardDescription>{t("settings.languageSoon")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={setLocale} className="flex gap-2">
            <Select name="locale" defaultValue={locale} className="max-w-xs" aria-label={t("settings.language")}>
              {LOCALES.map((l) => (
                <option key={l.code} value={l.code} disabled={!l.ready}>
                  {l.name}{l.ready ? "" : ` (${t("nav.comingSoon")})`}
                </option>
              ))}
            </Select>
            <Button type="submit" variant="outline">{t("settings.save")}</Button>
          </form>
        </CardContent>
      </Card>

      {logs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("settings.audit")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-xs">
              {logs.map((l) => (
                <li key={l.id} className="flex gap-3">
                  <span className="shrink-0 text-muted-foreground tabular-nums">{formatLagos(l.createdAt)}</span>
                  <code className="font-mono">{l.action}</code>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
