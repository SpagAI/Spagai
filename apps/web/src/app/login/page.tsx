import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { SpagLogo } from "@/components/spag-logo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getT } from "@/i18n/server";
import { getSession } from "@/server/auth/session";
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
        <p className="text-center text-xs text-muted-foreground">{t("app.prototype")}</p>
      </div>
    </main>
  );
}
