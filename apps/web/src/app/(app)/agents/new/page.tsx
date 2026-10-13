import { PRESETS } from "@spagai/core";
import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { getT } from "@/i18n/server";
import { redirect } from "next/navigation";
import { requireOrg } from "@/server/auth/session";
import { can } from "@/server/permissions";
import { createAgentFromPreset } from "../actions";

export const metadata: Metadata = { title: "New agent" };

export default async function NewAgentPage() {
  const ctx = await requireOrg();
  if (!can(ctx.role, "agent:edit")) redirect("/agents");
  const t = await getT();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("agents.choosePreset")}</h1>
        <p className="text-sm text-muted-foreground">{t("agents.choosePresetIntro")}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {PRESETS.map((p) => (
          <Card key={p.id}>
            <CardHeader>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="secondary">{p.sector.replace("_", " ")}</Badge>
                <Badge variant="outline">{t(`agents.direction.${p.direction}`)}</Badge>
                {p.status !== "ready" && <Badge variant="warning">{t(`agents.presetStatus.${p.status}`)}</Badge>}
              </div>
              <CardTitle className="pt-2">{p.name}</CardTitle>
              <CardDescription>{p.description}</CardDescription>
            </CardHeader>
            <CardFooter className="mt-auto">
              <form action={createAgentFromPreset} className="w-full">
                <input type="hidden" name="presetId" value={p.id} />
                <Button type="submit" variant="outline" className="w-full">{t("agents.use")}</Button>
              </form>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
