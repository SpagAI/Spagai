"use client";

import { Mail } from "lucide-react";
import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/i18n/client";
import { requestLoginLink, type LoginState } from "./actions";

export function LoginForm({ showDevHint }: { showDevHint: boolean }) {
  const t = useT();
  const [state, action, pending] = useActionState<LoginState, FormData>(requestLoginLink, { status: "idle" });

  if (state.status === "sent") {
    return (
      <div className="space-y-3">
        <Alert variant="success">
          <Mail />
          {t("login.sent")}
        </Alert>
        {state.devLink ? (
          <Alert>
            <p className="font-medium">{t("login.devShortcut")}</p>
            <Button asChild className="mt-3 w-full">
              <a href={state.devLink}>{t("login.devOpenLink")}</a>
            </Button>
          </Alert>
        ) : (
          showDevHint && <p className="text-sm text-muted-foreground">{t("login.devHint")}</p>
        )}
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">{t("login.email")}</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required placeholder={t("login.emailPlaceholder")} />
      </div>
      {state.status === "invalid" && <Alert variant="destructive">{t("login.invalidEmail")}</Alert>}
      {state.status === "rate_limited" && <Alert variant="destructive">{t("login.rateLimited")}</Alert>}
      <Button type="submit" className="w-full" disabled={pending}>
        {t("login.submit")}
      </Button>
    </form>
  );
}
