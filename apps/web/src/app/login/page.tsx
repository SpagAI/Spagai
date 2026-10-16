import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { SpagLogo } from "@/components/spag-logo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getT } from "@/i18n/server";
import { Button } from "@/components/ui/button";
import { getSession } from "@/server/auth/session";
import { env } from "@/server/env";
import { demoSignIn } from "./actions";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; deleted?: string }> }) {
  const { error, deleted } = await searchParams;
  if (!error && (await getSession())) redirect("/dashboard");
  const t = await getT();
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center text-center">
          <SpagLogo className="mb-3 h-12" title={t("app.brand")} />
          <p className="text-2xl font-semibold tracking-tight">{t("app.name")}</p>
          <p className="text-sm text-muted-foreground">{t("app.tagline")}</p>
        </div>
        {env.DEMO_MODE && (
          <Card className="border-primary/40">
            <CardHeader>
              <CardTitle>Try the demo</CardTitle>
              <CardDescription>Explore a sample workspace with agents, calls and reports. No sign-up needed. Nothing here is real: no calls are made and no money moves.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={demoSignIn}><Button type="submit" className="w-full">Enter the demo workspace</Button></form>
              {error === "no-demo" && <p className="mt-2 text-sm text-destructive">The demo data is not loaded yet. Try again in a minute.</p>}
              {error === "rate-limited" && <p className="mt-2 text-sm text-destructive">Too many tries. Please wait a few minutes.</p>}
            </CardContent>
          </Card>
        )}
        {/* On a demo site with no email service, the email sign-in could never arrive, so it is hidden. */}
        {!(env.DEMO_MODE && env.EMAIL_TRANSPORT === "console") && (
        <Card>
          <CardHeader>
            <CardTitle>{t("login.title")}</CardTitle>
            <CardDescription>{t("login.subtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {deleted && <Alert>Your account has been deleted. Thank you for using Spag AI.</Alert>}
            {error === "no-organisation" && <Alert variant="destructive">{t("login.noOrganisation")}</Alert>}
            <LoginForm showDevHint={process.env.NODE_ENV !== "production"} />
          </CardContent>
        </Card>
        )}
        <p className="text-center text-xs text-muted-foreground">{t("app.prototype")}</p>
      </div>
    </main>
  );
}
