"use client";

import {
  LANGUAGE_NAMES,
  lintSpokenLine,
  REQUIRED_TOOLS,
  renderVariables,
  sanitiseForSpeech,
  TOOL_DEFINITIONS,
  orderVoices,
  type AgentConfig,
  type ToolId,
  type Voice,
  type VoiceLanguage,
} from "@spagai/core";
import { TriangleAlert } from "lucide-react";
import { VoiceSettingsControls } from "@/components/voice/voice-settings";
import { VoicePicker } from "./voice-picker";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useSpeaker } from "@/components/voice/use-speaker";
import { useT } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { sampleValues, type TestLead } from "./shared";

type Update = (patch: Partial<AgentConfig>) => void;

export function BusinessTab({ config, update, lead, onLeadChange }: { config: AgentConfig; update: Update; lead: TestLead; onLeadChange: (lead: TestLead) => void }) {
  const t = useT();
  const agentVars = config.variables.filter((v) => v.scope === "agent");
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("builder.tabs.business")}</CardTitle>
        <CardDescription>{t("builder.business.intro")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {agentVars.map((v) => {
          const value = config.variableValues[v.name] ?? "";
          const missing = v.required && !value.trim();
          return (
            <div key={v.name} className="space-y-1.5">
              <Label htmlFor={`var-${v.name}`}>
                {v.label}
                {v.required && <span className="text-destructive"> *</span>}
              </Label>
              <Input
                id={`var-${v.name}`}
                value={value}
                placeholder={v.example ? `e.g. ${v.example}` : undefined}
                aria-invalid={missing}
                onChange={(e) => update({ variableValues: { ...config.variableValues, [v.name]: e.target.value } })}
              />
              <p className="font-mono text-[11px] text-muted-foreground">{`{{${v.name}}}`}</p>
            </div>
          );
        })}

        {config.direction !== "inbound" && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{t("builder.business.addressMode")}</legend>
          {(["A", "B"] as const).map((mode) => (
            <label key={mode} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="addressMode"
                value={mode}
                checked={config.addressMode === mode}
                onChange={() => update({ addressMode: mode })}
                className="accent-[var(--primary)]"
              />
              {t(mode === "A" ? "builder.business.modeA" : "builder.business.modeB")}
            </label>
          ))}
        </fieldset>
        )}

        {/* The person the agent talks to while testing (real calls use each lead's or caller's own details). */}
        {config.direction === "inbound" ? (
          <fieldset className="space-y-3 rounded-lg border bg-muted/20 p-4">
            <legend className="px-1 text-sm font-medium">Caller to test with</legend>
            <p className="text-xs text-muted-foreground">An inbound agent answers strangers, so it asks the caller&apos;s name. On real calls, the caller&apos;s number comes from the incoming call.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="tl-phone">Caller&apos;s phone number</Label><Input id="tl-phone" value={lead.phone ?? ""} onChange={(e) => onLeadChange({ ...lead, phone: e.target.value })} placeholder="e.g. 0803 555 0101" inputMode="tel" /></div>
              <div className="space-y-1.5"><Label htmlFor="tl-first">Caller&apos;s first name</Label><Input id="tl-first" value={lead.firstName} onChange={(e) => onLeadChange({ ...lead, firstName: e.target.value })} placeholder="e.g. Ngozi" /></div>
            </div>
          </fieldset>
        ) : (
          <fieldset className="space-y-3 rounded-lg border bg-muted/20 p-4">
            <legend className="px-1 text-sm font-medium">Person to test with</legend>
            <p className="text-xs text-muted-foreground">Who the agent calls when you test it and in the previews. On real calls, each person&apos;s own name from your lead list is used.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="tl-first">First name</Label><Input id="tl-first" value={lead.firstName} onChange={(e) => onLeadChange({ ...lead, firstName: e.target.value })} placeholder="e.g. Ngozi" /></div>
              <div className="space-y-1.5"><Label htmlFor="tl-last">Last name</Label><Input id="tl-last" value={lead.lastName} onChange={(e) => onLeadChange({ ...lead, lastName: e.target.value })} placeholder="e.g. Adeyemi" /></div>
              <div className="space-y-1.5"><Label htmlFor="tl-title">Title</Label><Input id="tl-title" value={lead.title} onChange={(e) => onLeadChange({ ...lead, title: e.target.value })} placeholder="Mr, Mrs, Dr… (optional)" /></div>
              <div className="space-y-1.5">
                <Label htmlFor="tl-gender">Gender</Label>
                <Select id="tl-gender" value={lead.gender} onChange={(e) => onLeadChange({ ...lead, gender: e.target.value as TestLead["gender"] })}>
                  <option value="male">Male</option><option value="female">Female</option><option value="unknown">Not known</option>
                </Select>
              </div>
            </div>
            <p className="text-sm">The agent will address them as <span className="font-semibold">“{sampleValues(config, lead).address || "—"}”</span>.</p>
          </fieldset>
        )}
      </CardContent>
    </Card>
  );
}

export function FirstMessageTab({ config, update, lead }: { config: AgentConfig; update: Update; lead?: TestLead }) {
  const t = useT();
  const filled = renderVariables(config.firstMessage, sampleValues(config, lead));
  const issues = lintSpokenLine(config.firstMessage);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("builder.tabs.firstMessage")}</CardTitle>
        <CardDescription>{t("builder.firstMessage.intro")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea rows={4} value={config.firstMessage} onChange={(e) => update({ firstMessage: e.target.value })} aria-label={t("builder.tabs.firstMessage")} />
        {issues.map((issue, i) => (
          <p key={i} className="flex gap-1.5 text-xs text-muted-foreground">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-warning" /> {issue.message}
          </p>
        ))}
        <div className="rounded-md border bg-muted/40 p-3 text-sm">
          <p className="text-xs font-medium text-muted-foreground">{t("builder.firstMessage.spokenAs")}</p>
          <p>{sanitiseForSpeech(filled)}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function ToolsTab({ config, update }: { config: AgentConfig; update: Update }) {
  const t = useT();
  const toggle = (id: ToolId, on: boolean) =>
    update({ tools: on ? [...new Set([...config.tools, id])] : config.tools.filter((x) => x !== id) });
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("builder.tabs.tools")}</CardTitle>
        <CardDescription>{t("builder.tools.intro")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {Object.values(TOOL_DEFINITIONS).map((tool) => {
          const required = REQUIRED_TOOLS.includes(tool.id);
          const on = required || config.tools.includes(tool.id);
          return (
            <div key={tool.id} className={cn("space-y-2 rounded-lg border p-3", on && "border-primary/40")}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{tool.name} <code className="ml-1 font-mono text-xs text-muted-foreground">{tool.id}</code></p>
                  <p className="text-sm text-muted-foreground">{tool.description}</p>
                </div>
                {required ? (
                  <Badge variant="secondary">{t("builder.tools.required")}</Badge>
                ) : (
                  <Switch checked={on} onCheckedChange={(v) => toggle(tool.id, v)} aria-label={tool.name} />
                )}
              </div>
              {Object.keys(tool.parameters).length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground">{t("builder.tools.params")}</summary>
                  <ul className="mt-2 space-y-1">
                    {Object.entries(tool.parameters).map(([name, p]) => (
                      <li key={name}>
                        <code className="font-mono">{name}</code>
                        {tool.required.includes(name) && <span className="text-destructive">*</span>}{" "}
                        <span className="text-muted-foreground">{p.description}{p.enum ? ` (${p.enum.join(", ")})` : ""}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export function SilenceTab({ config, update }: { config: AgentConfig; update: Update }) {
  const t = useT();
  const s = config.silence;
  const set = (patch: Partial<AgentConfig["silence"]>) => update({ silence: { ...s, ...patch } });
  const num = (v: string) => (v === "" ? 0 : Math.round(Number(v)));
  const invalid = s.endCallAfterSeconds <= s.checkInAfterSeconds;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("builder.tabs.silence")}</CardTitle>
        <CardDescription>{t("builder.silence.intro")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="checkIn">{t("builder.silence.checkInAfter")}</Label>
          <Input id="checkIn" type="number" min={3} max={60} value={s.checkInAfterSeconds} onChange={(e) => set({ checkInAfterSeconds: num(e.target.value) })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="maxCheckIns">{t("builder.silence.maxCheckIns")}</Label>
          <Input id="maxCheckIns" type="number" min={0} max={3} value={s.maxCheckIns} onChange={(e) => set({ maxCheckIns: num(e.target.value) })} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="checkInMessage">{t("builder.silence.checkInMessage")}</Label>
          <Input id="checkInMessage" value={s.checkInMessage} onChange={(e) => set({ checkInMessage: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="endAfter">{t("builder.silence.endAfter")}</Label>
          <Input id="endAfter" type="number" min={5} max={120} value={s.endCallAfterSeconds} aria-invalid={invalid} onChange={(e) => set({ endCallAfterSeconds: num(e.target.value) })} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="closingMessage">{t("builder.silence.closingMessage")}</Label>
          <Textarea id="closingMessage" rows={2} value={s.closingMessage} onChange={(e) => set({ closingMessage: e.target.value })} />
        </div>
      </CardContent>
    </Card>
  );
}

export function VoiceTab({ config, update, workspaceVoices = [], lead }: { config: AgentConfig; update: Update; workspaceVoices?: Voice[]; lead?: TestLead }) {
  const t = useT();
  const language = (Object.keys(LANGUAGE_NAMES) as VoiceLanguage[]).includes(config.language as VoiceLanguage)
    ? (config.language as VoiceLanguage)
    : "en-NG";
  // Real Fish Audio voices (built-in and added from the voice bank) come first.
  const voices = orderVoices(workspaceVoices).filter((v) => v.language === language);
  const speaker = useSpeaker();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("builder.tabs.voice")}</CardTitle>
        <CardDescription>{t("builder.voice.intro")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="max-w-xs space-y-1.5">
          <Label htmlFor="language">{t("builder.voice.language")}</Label>
          <Select id="language" value={language} onChange={(e) => update({ language: e.target.value, voiceId: null })}>
            {Object.entries(LANGUAGE_NAMES).map(([code, name]) => (
              <option key={code} value={code}>{name}</option>
            ))}
          </Select>
        </div>
        <VoiceSettingsControls
          value={config.voiceSettings}
          onChange={(voiceSettings) => update({ voiceSettings })}
          voiceId={voices.some((v) => v.id === config.voiceId) ? config.voiceId : null}
          sampleText={renderVariables(config.firstMessage, sampleValues(config, lead))}
          realVoice={voices.find((v) => v.id === config.voiceId)?.provider === "fish_audio"}
        />
        {speaker.error && <p className="text-sm text-destructive">{speaker.error}</p>}
        <VoicePicker
          voices={voices}
          selectedId={config.voiceId}
          playingId={speaker.playingKey}
          onChoose={(id) => update({ voiceId: id })}
          onPlay={(v) => (speaker.playingKey === v.id ? speaker.stop() : void speaker.speak(v.id, renderVariables(config.firstMessage, sampleValues(config, lead)), v.id, config.voiceSettings))}
        />
        {!config.voiceId && <p className="text-sm text-muted-foreground">{t("builder.voice.none")}</p>}
      </CardContent>
    </Card>
  );
}
