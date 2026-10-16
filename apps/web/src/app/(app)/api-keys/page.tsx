import { BookText, KeyRound } from "lucide-react";
import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOrg } from "@/server/auth/session";
import { db } from "@/server/db";
import { can } from "@/server/permissions";
import { CreateKey, KeyRow } from "./keys";

export const metadata: Metadata = { title: "API keys" };

const date = (d: Date) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" }).format(d);

function ago(d: Date | null): string {
  if (!d) return "Never used";
  const mins = Math.round((Date.now() - d.getTime()) / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return days < 30 ? `${days} day${days === 1 ? "" : "s"} ago` : date(d);
}

export default async function ApiKeysPage() {
  const ctx = await requireOrg();
  const canManage = can(ctx.role, "apikey:manage");
  const keys = await db.apiKey.findMany({ where: { organisationId: ctx.organisation.id }, orderBy: { createdAt: "desc" } });
  const people = await db.user.findMany({ where: { id: { in: keys.map((k) => k.createdById).filter((x): x is string => !!x) } }, select: { id: true, name: true, email: true } });
  const who = new Map(people.map((p) => [p.id, p.name || p.email]));

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">API keys</h1>
        <p className="text-sm text-muted-foreground">Let your own systems add leads, start calls and read results. Treat keys like passwords.</p>
      </div>

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><KeyRound className="size-5 text-primary" /> Create a key</CardTitle>
            <CardDescription>Give each system its own key, so you can delete one without affecting the others.</CardDescription>
          </CardHeader>
          <CardContent><CreateKey /></CardContent>
        </Card>
      ) : (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">Only owners and admins can create, view or delete API keys.</p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Your keys</CardTitle>
          <CardDescription>{keys.length} key{keys.length === 1 ? "" : "s"} in {ctx.organisation.name}</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {keys.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No keys yet.</p>
          ) : (
            <table className="w-full min-w-[720px] text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b"><th className="pb-2 font-medium">Name</th><th className="pb-2 font-medium">Key</th><th className="pb-2 font-medium">Created</th><th className="pb-2 font-medium">Last used</th><th className="pb-2" /></tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <KeyRow key={k.id} id={k.id} name={k.name} prefix={k.prefix} created={date(k.createdAt)} lastUsed={ago(k.lastUsedAt)} createdBy={(k.createdById && who.get(k.createdById)) || "a former member"} canManage={canManage} />
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><BookText className="size-5 text-primary" /> Quick start</CardTitle>
          <CardDescription>Send the key in the Authorization header.</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-lg bg-muted p-4 font-mono text-xs leading-relaxed">{`curl https://api.spagai.com/v1/leads \\
  -H "Authorization: Bearer spag_live_…" \\
  -H "Content-Type: application/json" \\
  -d '{"firstName":"Ada","phone":"+2348031234567","consent":true}'`}</pre>
        </CardContent>
      </Card>
    </div>
  );
}
