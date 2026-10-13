import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getT } from "@/i18n/server";
import { completeLogin } from "./actions";

/**
 * The emailed link opens this page, and the user clicks one button to finish.
 * We do not sign in on the GET request itself, because email security scanners
 * open links automatically and would use up the one-time token.
 */
export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const { token, error } = await searchParams;
  const t = await getT();
  const errorKey = error === "expired" || error === "used" ? error : error || !token ? "invalid" : null;

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{t("verify.title")}</CardTitle>
          {!errorKey && <CardDescription>{t("verify.body")}</CardDescription>}
        </CardHeader>
        <CardContent className="space-y-4">
          {errorKey ? (
            <>
              <Alert variant="destructive">{t(`verify.${errorKey}`)}</Alert>
              <Button asChild variant="outline" className="w-full">
                <Link href="/login">{t("verify.again")}</Link>
              </Button>
            </>
          ) : (
            <form action={completeLogin}>
              <input type="hidden" name="token" value={token} />
              <Button type="submit" className="w-full">
                {t("verify.submit")}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
