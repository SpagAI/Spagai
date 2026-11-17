"use client";

import {
  LANGUAGE_NAMES,
  lintSpokenLine,
  renderVariables,
  sanitiseForSpeech,
  orderVoices,
  type AgentConfig,
  type Voice,
  type VoiceLanguage,
} from "@spagai/core";
import { Loader2, Lock, Pencil, PhoneOff, Plug, Plus, TriangleAlert, Webhook } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { loadToolForEditing, type ToolSummary } from "@/app/(app)/tools/actions";
import { ToolForm } from "@/app/(app)/tools/tool-form";
import type { McpServerSummary } from "@/app/(app)/tools/mcp-actions";
import { McpConnectForm } from "@/app/(app)/tools/mcp-manager";
import { SubTabs } from "@/components/sub-tabs";
import { fullToolName } from "@/lib/mcp";
import { Button } from "@/components/ui/button";
import { BLANK_TOOL, DEFAULT_TOOLS, type ToolInput } from "@/lib/custom-tools";
import { VoiceSettingsControls } from "@/components/voice/voice-settings";
import { VoicePicker } from "./voice-picker";
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

export type WorkspaceTool = ToolSummary;

/** Tools every agent has; shown so people know they are there, but locked. */
export function DefaultTools() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Default tools</CardTitle>
        <CardDescription>Every agent has these. They are always on and cannot be changed.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {DEFAULT_TOOLS.map((tool) => (
          <div key={tool.name} className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground"><PhoneOff className="size-4" /></span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{tool.label} <code className="ml-1 font-mono text-xs text-muted-foreground">{tool.name}</code></p>
              <p className="text-sm text-muted-foreground">{tool.description}</p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-muted-foreground"><Lock className="size-3" /> Always on</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/** Allowed tools from connected MCP servers, switched on per agent; servers can be connected here too. */
function McpToolsCard({ config, update, servers, onServersChange, canManage }: { config: AgentConfig; update: Update; servers: McpServerSummary[]; onServersChange: (s: McpServerSummary[]) => void; canManage: boolean }) {
  const [connecting, setConnecting] = useState(false);
  const toggle = (name: string, on: boolean) => update({ mcpTools: on ? [...new Set([...config.mcpTools, name])] : config.mcpTools.filter((x) => x !== name) });
  const known = new Set(servers.flatMap((m) => m.tools.filter((t) => t.allowed).map((t) => fullToolName(m.name, t.name))));
  const missing = config.mcpTools.filter((n) => !known.has(n));
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1.5">
            <CardTitle>MCP tools</CardTitle>
            <CardDescription>Tools from services you connect through MCP, such as your Make.com scenarios.</CardDescription>
          </div>
          {canManage && !connecting && <Button variant="outline" size="sm" onClick={() => setConnecting(true)}><Plug /> Connect an MCP server</Button>}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {connecting && <McpConnectForm onSaved={(s) => { onServersChange([...servers, s]); setConnecting(false); }} onCancel={() => setConnecting(false)} />}
        {servers.length === 0 && !connecting && <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No MCP servers connected yet.{canManage ? " Connect one to use its actions as tools." : " Ask an owner or admin to connect one."}</p>}
        {servers.map((m) => {
          const allowed = m.tools.filter((t) => t.allowed);
          return (
            <div key={m.id} className="space-y-2">
              <p className="flex items-center gap-2 text-sm font-medium"><Plug className="size-4 text-primary" /> {m.label} <span className="text-xs font-normal text-muted-foreground">{m.host}</span></p>
              {allowed.length === 0 && <p className="text-xs text-muted-foreground">No tools allowed from this server yet (choose them on the Tools page).</p>}
              {allowed.map((t) => {
                const name = fullToolName(m.name, t.name);
                const on = config.mcpTools.includes(name);
                return (
                  <div key={name} className={cn("flex items-start gap-3 rounded-lg border p-3", on && "border-primary/40")}>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium"><code className="text-sm">{t.name}</code></p>
                      {t.description && <p className="line-clamp-2 text-sm text-muted-foreground">{t.description}</p>}
                      <p className="mt-0.5 text-xs text-muted-foreground">The AI calls it <code>{name}</code></p>
                    </div>
                    <Switch checked={on} onCheckedChange={(v) => toggle(name, v)} aria-label={t.name} />
                  </div>
                );
              })}
            </div>
          );
        })}
        {missing.map((name) => (
          <div key={name} className="flex items-center gap-3 rounded-lg border border-warning/50 p-3 text-sm">
            <TriangleAlert className="size-4 shrink-0 text-warning" />
            <span className="flex-1"><code className="font-mono">{name}</code> is no longer available.</span>
            <button type="button" className="text-primary hover:underline" onClick={() => toggle(name, false)}>Remove</button>
          </div>
        ))}
        {servers.length > 0 && canManage && <Link href="/tools" className="inline-block text-xs text-primary hover:underline">Choose allowed tools, refresh or test on the Tools page</Link>}
      </CardContent>
    </Card>
  );
}

export function ToolsTab({ config, update, workspaceTools, canManageTools, onToolSaved, mcpServers = [], onMcpServersChange = () => {} }: { config: AgentConfig; update: Update; workspaceTools: WorkspaceTool[]; canManageTools: boolean; onToolSaved: (tool: ToolSummary) => void; mcpServers?: McpServerSummary[]; onMcpServersChange?: (s: McpServerSummary[]) => void }) {
  const [editing, setEditing] = useState<{ id: string | null; initial: ToolInput } | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const topRef = useRef<HTMLDivElement>(null);
  // The form opens in place of the list; if its top is above the screen, bring it into view.
  const showTop = () => requestAnimationFrame(() => {
    const el = topRef.current;
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: "start" });
  });
  const close = () => { setEditing(null); showTop(); };
  const openEdit = async (id: string) => {
    setLoadingId(id);
    const initial = await loadToolForEditing(id).catch(() => null);
    setLoadingId(null);
    if (initial) { setEditing({ id, initial }); showTop(); }
  };
  const toggleCustom = (name: string, on: boolean) =>
    update({ customTools: on ? [...new Set([...config.customTools, name])] : config.customTools.filter((x) => x !== name) });
  // A tool that was deleted or renamed elsewhere: shown so it can be switched off.
  const missing = config.customTools.filter((n) => !workspaceTools.some((w) => w.name === n));
  if (editing) {
    return (
      <div ref={topRef} className="scroll-mt-4">
        <ToolForm
          id={editing.id}
          initial={editing.initial}
          mode="inline"
          onCancel={close}
          onSaved={(tool, created) => {
            onToolSaved(tool);
            // A new tool is switched on for this agent straight away.
            if (created) update({ customTools: [...new Set([...config.customTools, tool.name])] });
            close();
          }}
        />
      </div>
    );
  }

  return (
    <div ref={topRef} className="scroll-mt-4">
      <SubTabs
        label="Kinds of tools"
        tabs={[
          {
            id: "tools",
            label: "Tools",
            count: config.customTools.length + DEFAULT_TOOLS.length,
            content: (
              <div className="space-y-5">
      <DefaultTools />
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1.5">
              <CardTitle>Your tools</CardTitle>
              <CardDescription>Your own actions, such as booking in your calendar or adding a lead to your CRM. When the agent uses one, the details it collected are sent to your webhook.</CardDescription>
            </div>
            {canManageTools && (
              <Button variant="outline" size="sm" onClick={() => (setEditing({ id: null, initial: BLANK_TOOL }), showTop())}><Plus /> New tool</Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {workspaceTools.length === 0 && missing.length === 0 && (
            <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              No tools yet. {canManageTools ? <><button type="button" onClick={() => (setEditing({ id: null, initial: BLANK_TOOL }), showTop())} className="text-primary underline-offset-4 hover:underline">Create one here</button> (calendar booking, CRM lead, Google Sheet and more) or on the <Link href="/tools" className="text-primary underline-offset-4 hover:underline">Tools page</Link>.</> : "Ask an owner or admin to create one."}
            </p>
          )}
          {workspaceTools.map((tool) => {
            const on = config.customTools.includes(tool.name);
            return (
              <div key={tool.name} className={cn("flex items-start gap-3 rounded-lg border p-3", on && "border-primary/40")}>
                <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary"><Webhook className="size-4" /></span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {tool.label} <code className="ml-1 font-mono text-xs text-muted-foreground">{tool.name}</code>
                  </p>
                  <p className="line-clamp-2 text-sm text-muted-foreground">{tool.description}</p>
                  <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    Sends to {tool.host}
                    {canManageTools && (
                      <button type="button" onClick={() => openEdit(tool.id)} className="inline-flex items-center gap-0.5 text-primary hover:underline">
                        {loadingId === tool.id ? <Loader2 className="size-3 animate-spin" /> : <Pencil className="size-3" />} Edit
                      </button>
                    )}
                  </p>
                </div>
                <Switch checked={on} onCheckedChange={(v) => toggleCustom(tool.name, v)} aria-label={tool.label} />
              </div>
            );
          })}
          {missing.map((name) => (
            <div key={name} className="flex items-center gap-3 rounded-lg border border-warning/50 p-3 text-sm">
              <TriangleAlert className="size-4 shrink-0 text-warning" />
              <span className="flex-1"><code className="font-mono">{name}</code> no longer exists in this workspace.</span>
              <button type="button" className="text-primary hover:underline" onClick={() => toggleCustom(name, false)}>Remove</button>
            </div>
          ))}
          {config.customTools.length > 0 && (
            <p className="text-xs text-muted-foreground">Tip: mention each tool in your prompt (e.g. &quot;Once they agree a time, use book_in_calendar&quot;) so the agent knows when to use it.</p>
          )}
        </CardContent>
      </Card>

              </div>
            ),
          },
          {
            id: "mcp",
            label: "MCP servers",
            count: config.mcpTools.length,
            content: <McpToolsCard config={config} update={update} servers={mcpServers} onServersChange={onMcpServersChange} canManage={canManageTools} />,
          },
        ]}
      />
    </div>
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
