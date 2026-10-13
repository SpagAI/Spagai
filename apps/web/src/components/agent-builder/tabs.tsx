"use client";

import {
  LANGUAGE_NAMES,
  lintSpokenLine,
  REQUIRED_TOOLS,
  renderVariables,
  sanitiseForSpeech,
  TOOL_DEFINITIONS,
  VOICE_CATALOGUE,
  type AgentConfig,
  type ToolId,
  type VoiceLanguage,
} from "@spagai/core";
import { Check, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { sampleValues } from "./shared";

type Update = (patch: Partial<AgentConfig>) => void;

export function BusinessTab({ config, update }: { config: AgentConfig; update: Update }) {
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
      </CardContent>
    </Card>
  );
}

export function FirstMessageTab({ config, update }: { config: AgentConfig; update: Update }) {
  const t = useT();
  const filled = renderVariables(config.firstMessage, sampleValues(config));
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

export function VoiceTab({ config, update }: { config: AgentConfig; update: Update }) {
  const t = useT();
  const language = (Object.keys(LANGUAGE_NAMES) as VoiceLanguage[]).includes(config.language as VoiceLanguage)
    ? (config.language as VoiceLanguage)
    : "en-NG";
  const voices = VOICE_CATALOGUE.filter((v) => v.language === language);
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
        <div className="grid gap-3 sm:grid-cols-2">
          {voices.map((v) => {
            const selected = config.voiceId === v.id;
            const usable = v.status === "available";
            return (
              <button
                key={v.id}
                type="button"
                disabled={!usable}
                onClick={() => update({ voiceId: v.id })}
                className={cn(
                  "space-y-1 rounded-lg border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                  selected ? "border-primary bg-primary/5" : "hover:border-primary/50",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{v.name}</span>
                  {selected ? <Check className="size-4 text-primary" /> : <Badge variant="outline">{v.provider}</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">{v.gender} · {LANGUAGE_NAMES[v.language]}</p>
                <p className="text-xs italic text-muted-foreground">“{v.sampleText}”</p>
                {!usable && <Badge variant="warning">{t("builder.voice.notConfigured")}</Badge>}
              </button>
            );
          })}
        </div>
        {!config.voiceId && <p className="text-sm text-muted-foreground">{t("builder.voice.none")}</p>}
      </CardContent>
    </Card>
  );
}
