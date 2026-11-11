import { orderVoices, PRESETS } from "@spagai/core";
import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { getT } from "@/i18n/server";
import { redirect } from "next/navigation";
import { requireOrg } from "@/server/auth/session";
import { can } from "@/server/permissions";
import { Bot, LayoutTemplate, PenLine, SlidersHorizontal, Sparkles } from "lucide-react";
import Link from "next/link";
import { CustomAgentForm } from "@/components/agent-builder/custom-agent-form";
import { cn } from "@/lib/utils";
import { PendingButton } from "@/components/confirm-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { NewAgentVoiceInput, NewAgentVoicePicker, NewAgentVoiceProvider } from "@/components/agent-builder/new-agent-voice";
import { listWorkspaceVoices } from "@/server/voices";
import { createAgentFromPreset, createBlankAgent } from "../actions";

export const metadata: Metadata = { title: "New agent" };

const WAYS = [
  { id: "custom", icon: SlidersHorizontal, title: "Custom", text: "Set everything yourself: your own prompt, first message, voice and voice settings." },
  { id: "quick", icon: PenLine, title: "Quick start", text: "Describe what it should do and we set up the basics for you to edit." },
  { id: "template", icon: LayoutTemplate, title: "Template", text: "Start from a ready-made agent for a common job, then edit it." },
  { id: "ai", icon: Bot, title: "Build with AI", text: "Chat with Zara, our AI. She plans and builds the agent for you." },
] as const;

export default async function NewAgentPage({ searchParams }: { searchParams: Promise<{ start?: string }> }) {
  const ctx = await requireOrg();
  if (!can(ctx.role, "agent:edit")) redirect("/agents");
  const start = (await searchParams).start;
  const t = await getT();
  const all = orderVoices(await listWorkspaceVoices(ctx.organisation.id)).filter((v) => v.status === "available");
  // English voices, real Fish Audio voices first. A conversational one is picked to start with.
  const voices = all.filter((v) => v.language === "en-NG");
  const initial = (voices.find((v) => v.provider === "fish_audio" && v.category === "Conversational") ?? voices[0])?.id ?? "";
  return (
    <NewAgentVoiceProvider initial={initial}>
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Create an agent</h1>
        <p className="text-sm text-muted-foreground">How do you want to start? You can change everything later in the builder.</p>
      </div>

      <nav aria-label="Ways to create an agent" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {WAYS.map((w) => {
          const active = start === w.id;
          return (
            <Link
              key={w.id}
              href={w.id === "ai" ? "/home" : `/agents/new?start=${w.id}`}
              scroll={false}
              aria-current={active ? "true" : undefined}
              className={cn("flex flex-col gap-1.5 rounded-xl border bg-card p-4 transition-colors hover:border-primary/50", active && "border-primary bg-primary/5 ring-1 ring-primary/30")}
            >
              <span className="flex items-center gap-2 font-semibold"><w.icon className="size-5 text-primary" /> {w.title}</span>
              <span className="text-sm text-muted-foreground">{w.text}</span>
            </Link>
          );
        })}
      </nav>

      {!start && <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Choose one of the options above to begin.</p>}

      {start === "custom" && (
        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><SlidersHorizontal className="size-5 text-primary" /> Custom agent</CardTitle>
            <CardDescription>Everything is yours to set. Nothing is written for you.</CardDescription>
          </CardHeader>
          <CardContent><CustomAgentForm voices={all} company={ctx.organisation.name} storageKey={`spagai:custom-agent:${ctx.organisation.id}`} /></CardContent>
        </Card>
      )}

      {(start === "quick" || start === "template") && (
      <Card>
        <CardContent>
          <NewAgentVoicePicker voices={voices} company={ctx.organisation.name} />
        </CardContent>
      </Card>

      )}

      {start === "quick" && (
      <Card className="border-primary/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><PenLine className="size-5 text-primary" /> Quick start</CardTitle>
          <CardDescription>Describe what you want, and we set up the basics, including the standard safety rules.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createBlankAgent} className="grid gap-4 md:grid-cols-2">
            <NewAgentVoiceInput />
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
      )}

      {start === "template" && (
      <>
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
                <NewAgentVoiceInput />
                <Button type="submit" variant="outline" className="w-full">{t("agents.use")}</Button>
              </form>
            </CardFooter>
          </Card>
        ))}
      </div>
      </>
      )}
    </div>
    </NewAgentVoiceProvider>
  );
}
