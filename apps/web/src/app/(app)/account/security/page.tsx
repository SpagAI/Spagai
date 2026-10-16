import { Laptop, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatLagos } from "@/lib/format";
import { requireOrg } from "@/server/auth/session";
import { db } from "@/server/db";
import { PasswordForm, SignOutOthers } from "../forms";

export const metadata: Metadata = { title: "Password and security" };

export default async function SecurityPage() {
  const ctx = await requireOrg();
  const sessions = await db.session.findMany({ where: { userId: ctx.user.id, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" }, take: 10 });

  return (
    <div className="max-w-3xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Password and security</h1>
        <p className="text-sm text-muted-foreground">Keep your account safe.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
          <CardDescription>You can also always sign in with a one-time link sent to your email.</CardDescription>
        </CardHeader>
        <CardContent><PasswordForm /></CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="size-5 text-primary" /> Signed-in devices</CardTitle>
          <CardDescription>Each place you are signed in. Sign out of the others if you do not recognise one.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="divide-y rounded-lg border">
            {sessions.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                <Laptop className="size-4 text-muted-foreground" />
                <span className="flex-1">Signed in {formatLagos(s.createdAt)} WAT</span>
                {s.id === ctx.sessionId && <Badge variant="secondary">This device</Badge>}
              </li>
            ))}
          </ul>
          <SignOutOthers />
        </CardContent>
      </Card>
    </div>
  );
}
