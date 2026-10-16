"use client";

import { getVoice, TOOL_DEFINITIONS, type AgentConfig } from "@spagai/core";
import { ArrowLeft, CircleAlert, CircleCheck, CircleX, Clock, PhoneCall, PhoneOff, RotateCcw, Send, Settings2, TriangleAlert, Volume2, VolumeX } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { simulate, type AgentLine, type SimulateInput } from "@/app/(app)/lab/actions";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { PlayButton } from "@/components/voice/play-button";
import { useSpeaker } from "@/components/voice/use-speaker";
import { useT } from "@/i18n/client";
import { cn } from "@/lib/utils";

/** Call variables filled from the customer fields, so they are not asked for twice. */
const FROM_LEAD = new Set(["lead_name", "first_name", "last_name", "title", "address", "suffix", "full_name", "name"]);

type Entry = { id: number; role: "agent"; line: AgentLine } | { id: number; role: "caller"; text: string };
type Status = "idle" | "live" | "ended";

export interface SimulatorProps {
  agentId: string;
  config: AgentConfig;
  initialWhen: string;
  provider: string;
}

export function Simulator({ agentId, config, initialWhen, provider }: SimulatorProps) {
  const t = useT();
  const speaker = useSpeaker();
  const voice = getVoice(config.voiceId);
  const callVars = config.variables.filter((v) => v.scope === "call" && !FROM_LEAD.has(v.name));

  const [lead, setLead] = useState<SimulateInput["lead"]>({ title: "", gender: "male", firstName: "Chinedu", lastName: "Okafor" });
  const [callValues, setCallValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(callVars.map((v) => [v.name, v.example ?? v.defaultValue ?? ""])),
  );
  const [when, setWhen] = useState(initialWhen);
  const [speakAloud, setSpeakAloud] = useState(Boolean(voice));
  const [entries, setEntries] = useState<Entry[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [checkIns, setCheckIns] = useState(0);
  const [draft, setDraft] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [callingWindow, setCallingWindow] = useState<{ allowed: boolean; reason: string | null } | null>(null);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const nextId = useRef(1);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [entries.length]);

  const run = (event: SimulateInput["event"], before: Entry[]) =>
    startTransition(async () => {
      const result = await simulate({ agentId, lead, callValues, when, history: before.map((e) => (e.role === "agent" ? { role: "agent", text: e.line.text } : { role: "caller", text: e.text })), event });
      if (!result.ok) {
        setErrors(result.errors);
        if (event.type === "start") setStatus("idle");
        return;
      }
      setErrors([]);
      if (result.callingWindow) setCallingWindow(result.callingWindow);
      if (result.prompt) setPrompt(result.prompt);
      const entry: Entry = { id: nextId.current++, role: "agent", line: result.line };
      setEntries([...before, entry]);
      if (result.line.endsCall) setStatus("ended");
      if (speakAloud && voice) void speaker.speak(voice.id, result.line.text, `line-${entry.id}`);
      inputRef.current?.focus();
    });

  const start = () => {
    speaker.stop();
    setEntries([]);
    setCheckIns(0);
    setPrompt(null);
    setCallingWindow(null);
    setStatus("live");
    run({ type: "start" }, []);
  };

  const send = () => {
    const text = draft.trim();
    if (!text || status !== "live" || pending) return;
    const withCaller: Entry[] = [...entries, { id: nextId.current++, role: "caller", text }];
    setEntries(withCaller);
    setDraft("");
    setCheckIns(0);
    run({ type: "message", text }, withCaller);
  };

  const silence = () => {
    if (status !== "live" || pending) return;
    run({ type: "silence", checkInsSoFar: checkIns }, entries);
    setCheckIns((n) => n + 1);
  };

  const hangUp = () => {
    speaker.stop();
    setStatus("ended");
  };

  const toolLog = entries.flatMap((e) => (e.role === "agent" ? e.line.toolCalls : []));
  const settingsLocked = status === "live";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="icon" aria-label={t("common.back")}>
          <Link href="/lab"><ArrowLeft /></Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold tracking-tight">{t("simulator.testing")} {config.name}</h1>
          <p className="text-xs text-muted-foreground">
            {t("simulator.brain")}: {provider === "mock" ? t("simulator.mockBrain") : provider} · {t("simulator.voice")}: {voice?.name ?? t("builder.voice.none")}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/agents/${agentId}`}><Settings2 /> {t("simulator.editAgent")}</Link>
        </Button>
      </div>

      {provider === "mock" && <Alert><CircleAlert />{t("simulator.mockNote")}</Alert>}

      <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
        {/* Settings */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>{t("simulator.customer")}</CardTitle>
            <CardDescription>{t("simulator.customerIntro")}</CardDescription>
          </CardHeader>
          <CardContent>
            <fieldset disabled={settingsLocked} className="space-y-3">
              <div className="grid grid-cols-[5rem_1fr] gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="sim-title">{t("simulator.personTitle")}</Label>
                  <Input id="sim-title" value={lead.title} placeholder="Dr" onChange={(e) => setLead({ ...lead, title: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sim-gender">{t("simulator.gender")}</Label>
                  <Select id="sim-gender" value={lead.gender} onChange={(e) => setLead({ ...lead, gender: e.target.value as SimulateInput["lead"]["gender"] })}>
                    <option value="male">{t("voices.male")}</option>
                    <option value="female">{t("voices.female")}</option>
                    <option value="unknown">{t("simulator.unknown")}</option>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="sim-first">{t("simulator.firstName")}</Label>
                  <Input id="sim-first" value={lead.firstName} onChange={(e) => setLead({ ...lead, firstName: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sim-last">{t("simulator.lastName")}</Label>
                  <Input id="sim-last" value={lead.lastName} onChange={(e) => setLead({ ...lead, lastName: e.target.value })} />
                </div>
              </div>
              {callVars.map((v) => (
                <div key={v.name} className="space-y-1.5">
                  <Label htmlFor={`sim-${v.name}`}>{v.label}{v.required && <span className="text-destructive"> *</span>}</Label>
                  <Input id={`sim-${v.name}`} value={callValues[v.name] ?? ""} onChange={(e) => setCallValues({ ...callValues, [v.name]: e.target.value })} />
                </div>
              ))}
              <div className="space-y-1.5">
                <Label htmlFor="sim-when">{t("simulator.when")}</Label>
                <Input id="sim-when" type="datetime-local" value={when} onChange={(e) => e.target.value && setWhen(e.target.value)} />
              </div>
            </fieldset>
            <label className="mt-4 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={speakAloud} disabled={!voice} onChange={(e) => setSpeakAloud(e.target.checked)} className="accent-[var(--primary)]" />
              {speakAloud ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
              {t("simulator.speakAloud")}
            </label>
            <Button type="button" className="mt-4 w-full" onClick={start} disabled={pending}>
              {status === "idle" ? <PhoneCall /> : <RotateCcw />}
              {status === "idle" ? t("simulator.start") : t("simulator.restart")}
            </Button>
          </CardContent>
        </Card>

        {/* Conversation */}
        <div className="min-w-0 space-y-4">
          {errors.length > 0 && (
            <Alert variant="destructive">
              <CircleAlert />
              <p className="font-medium">{t("simulator.cannotStart")}</p>
              <ul className="list-disc space-y-0.5 pl-6">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
            </Alert>
          )}
          {callingWindow && !callingWindow.allowed && (
            <Alert variant="warning">
              <Clock />
              {t("simulator.outsideHours")} {callingWindow.reason}
            </Alert>
          )}

          <Card>
            <CardContent className="space-y-3 pt-6">
              {entries.length === 0 && !pending && (
                <p className="py-10 text-center text-sm text-muted-foreground">{t("simulator.empty")}</p>
              )}
              {entries.map((e) =>
                e.role === "caller" ? (
                  <div key={e.id} className="flex justify-end">
                    <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2 text-sm text-primary-foreground">{e.text}</p>
                  </div>
                ) : (
                  <AgentBubble
                    key={e.id}
                    line={e.line}
                    playing={speaker.playingKey === `line-${e.id}`}
                    canPlay={Boolean(voice)}
                    onPlay={() => voice && void speaker.speak(voice.id, e.line.text, `line-${e.id}`)}
                    onStop={speaker.stop}
                  />
                ),
              )}
              {pending && <p className="animate-pulse text-sm text-muted-foreground">{t("simulator.thinking")}</p>}
              {status === "ended" && (
                <p className="flex items-center justify-center gap-2 border-t pt-3 text-sm text-muted-foreground">
                  <PhoneOff className="size-4" /> {t("simulator.ended")}
                </p>
              )}
              <div ref={bottomRef} />
            </CardContent>
          </Card>

          {status === "live" && (
            <form
              className="flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
            >
              <Input
                ref={inputRef}
                className="min-w-0 flex-1 basis-60"
                value={draft}
                maxLength={1000}
                placeholder={t("simulator.replyPlaceholder")}
                aria-label={t("simulator.replyPlaceholder")}
                onChange={(e) => setDraft(e.target.value)}
                autoFocus
              />
              <Button type="submit" disabled={pending || !draft.trim()}><Send /> {t("simulator.send")}</Button>
              <Button type="button" variant="outline" disabled={pending} onClick={silence}>{t("simulator.silent")}</Button>
              <Button type="button" variant="ghost" className="text-destructive" onClick={hangUp}><PhoneOff /> {t("simulator.hangUp")}</Button>
            </form>
          )}

          {status === "live" && entries.length > 0 && (
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="text-muted-foreground">{t("simulator.tryThese")}</span>
              {["Yes, go ahead", "Am I talking to a robot?", "I'm busy, call me later", "Thursday at 10am", "Please stop calling me"].map((s) => (
                <button key={s} type="button" disabled={pending} onClick={() => setDraft(s)} className="rounded-full border px-2.5 py-0.5 hover:border-primary/50 disabled:opacity-50">
                  {s}
                </button>
              ))}
            </div>
          )}

          {toolLog.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("simulator.actions")}</CardTitle>
                <CardDescription>{t("simulator.actionsIntro")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {toolLog.map((c, i) => <ToolRow key={i} call={c} />)}
              </CardContent>
            </Card>
          )}

          {prompt && (
            <details className="rounded-lg border p-3 text-sm">
              <summary className="cursor-pointer font-medium">{t("simulator.prompt")}</summary>
              <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap font-mono text-xs text-muted-foreground">{prompt}</pre>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}

function AgentBubble({ line, playing, canPlay, onPlay, onStop }: { line: AgentLine; playing: boolean; canPlay: boolean; onPlay: () => void; onStop: () => void }) {
  const t = useT();
  return (
    <div className="flex flex-col items-start gap-1.5">
      {line.afterSeconds !== undefined && (
        <p className="text-xs text-muted-foreground">{t("simulator.afterSilence").replace("{seconds}", String(line.afterSeconds))}</p>
      )}
      <div className="flex max-w-[85%] items-start gap-2">
        <div className="rounded-2xl rounded-bl-sm bg-muted px-4 py-2 text-sm">
          <p>{line.text}</p>
          {line.spoken !== line.text && (
            <p className="mt-1.5 border-t pt-1.5 text-xs text-muted-foreground">{t("builder.firstMessage.spokenAs")}: {line.spoken}</p>
          )}
        </div>
        {canPlay && <PlayButton size="icon" playing={playing} onPlay={onPlay} onStop={onStop} />}
      </div>
      {line.issues.map((issue, i) => (
        <p key={i} className="flex max-w-[85%] gap-1.5 text-xs text-muted-foreground">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-warning" /> {issue.message}
        </p>
      ))}
      {line.toolCalls.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {line.toolCalls.map((c, i) => (
            <Badge key={i} variant={c.ok ? "secondary" : "destructive"}>{TOOL_DEFINITIONS[c.tool].name}</Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function ToolRow({ call }: { call: AgentLine["toolCalls"][number] }) {
  const args = Object.entries(call.args);
  return (
    <div className={cn("flex gap-2 rounded-md border p-2.5 text-sm", !call.ok && "border-destructive/40")}>
      {call.ok ? <CircleCheck className="mt-0.5 size-4 shrink-0 text-primary" /> : <CircleX className="mt-0.5 size-4 shrink-0 text-destructive" />}
      <div className="min-w-0 space-y-0.5">
        <p className="font-medium">{TOOL_DEFINITIONS[call.tool].name} <code className="ml-1 font-mono text-xs text-muted-foreground">{call.tool}</code></p>
        {args.length > 0 && (
          <p className="break-words font-mono text-xs text-muted-foreground">{args.map(([k, v]) => `${k}: ${String(v)}`).join(" · ")}</p>
        )}
        <p className="text-xs">{call.result}</p>
      </div>
    </div>
  );
}
