import { PRESETS } from "@spagai/core";
import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { getT } from "@/i18n/server";
import { redirect } from "next/navigation";
import { requireOrg } from "@/server/auth/session";
import { can } from "@/server/permissions";
import { PenLine, Sparkles } from "lucide-react";
import { PendingButton } from "@/components/confirm-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createAgentFromPreset, createBlankAgent } from "../actions";

export const metadata: Metadata = { title: "New agent" };

export default async function NewAgentPage() {
  const ctx = await requireOrg();
  if (!can(ctx.role, "agent:edit")) redirect("/agents");
  const t = await getT();
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Create an agent</h1>
        <p className="text-sm text-muted-foreground">Build your own from scratch, or start from a ready-made template. Next you will choose its voice, write its instructions, give it knowledge, connect a phone number and test it in the Lab.</p>
      </div>

      <Card className="border-primary/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><PenLine className="size-5 text-primary" /> Start from scratch</CardTitle>
          <CardDescription>Describe what you want, and we set up the basics, including the standard safety rules.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createBlankAgent} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="agent-name">Agent name</Label><Input id="agent-name" name="name" required maxLength={80} placeholder="e.g. Ada" /></div>
            <div className="space-y-1.5"><Label htmlFor="agent-company">Business name</Label><Input id="agent-company" name="company" maxLength={120} defaultValue={ctx.organisation.name} /></div>
            <div className="space-y-1.5">
              <Label htmlFor="agent-direction">Calls</Label>
              <Select id="agent-direction" name="direction" defaultValue="outbound">
                <option value="outbound">It calls customers (outbound)</option>
                <option value="inbound">It answers calls (inbound)</option>
              </Select>
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="agent-purpose">What should it do?</Label>
              <Textarea id="agent-purpose" name="purpose" rows={3} maxLength={2000} placeholder="e.g. Call people who filled our website form, answer questions about our two-bedroom flats in Lekki, and book a viewing." />
            </div>
            <div className="md:col-span-2"><PendingButton pendingText="Creating your agent…"><Sparkles /> Create agent</PendingButton></div>
          </form>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-lg font-semibold">{t("agents.choosePreset")}</h2>
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
