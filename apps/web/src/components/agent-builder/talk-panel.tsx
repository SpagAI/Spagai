"use client";

import type { AgentConfig, Voice } from "@spagai/core";
import { Keyboard, Loader2, Mic, PhoneOff, Send, Settings2, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { talkToAgent, type AgentLine, type SimulateInput } from "@/app/(app)/lab/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useListener } from "@/components/voice/use-listener";
import { useRecorderListener } from "@/components/voice/use-recorder-listener";
import { useSpeaker } from "@/components/voice/use-speaker";
import { cn } from "@/lib/utils";
import type { TestLead } from "./shared";

/** Call values that come from the pretend customer's name fields. */
const FROM_LEAD = new Set(["lead_name", "first_name", "last_name", "title", "gender", "address", "suffix", "full_name", "name"]);

type Entry = { id: number; role: "agent"; line: AgentLine } | { id: number; role: "caller"; text: string };
type Phase = "idle" | "connecting" | "speaking" | "listening" | "thinking" | "ended";

const PHASE_TEXT: Record<Phase, string> = {
  idle: "",
  connecting: "Calling…",
  speaking: "Speaking…",
  listening: "Listening… just talk",
  thinking: "Thinking…",
  ended: "Call ended",
};

export interface TalkPanelProps {
  config: AgentConfig;
  voice?: Voice;
  provider: string;
  initialWhen: string;
  /** The pretend person being called (set in Business details). */
  lead: TestLead;
  /** True when our server can do the listening (sharp on any browser); otherwise the browser listens. */
  serverListening?: boolean;
}

/**
 * "Test your agent": one button. The agent speaks first, then the microphone listens by itself,
 * like a phone call. Uses the settings on screen (even unsaved). Typing is there as a fallback.
 */
export function TalkPanel({ config, voice, provider, initialWhen, lead, serverListening = false }: TalkPanelProps) {
  const speaker = useSpeaker();
  const browserListener = useListener(config.language);
  // Words to help the listener: the agent's own names and the test person's name.
  const recorder = useRecorderListener(config.language, () =>
    [config.name, ...Object.values(config.variableValues), lead.firstName, lead.lastName].filter((w) => w && w.length <= 60),
  );
  const listener = serverListening && recorder.supported ? recorder : browserListener;
  const level = listener === recorder ? recorder.level : 0;
  const callVars = config.variables.filter((v) => v.scope === "call" && !FROM_LEAD.has(v.name));

  const [callValues, setCallValues] = useState<Record<string, string>>({});
  const [when, setWhen] = useState(initialWhen);
  const [speakAloud, setSpeakAloud] = useState(Boolean(voice));
  const [typeMode, setTypeMode] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [draft, setDraft] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [outsideHours, setOutsideHours] = useState<string | null>(null);

  // Latest values for callbacks that fire after speaking or listening ends.
  const entriesRef = useRef<Entry[]>([]);
  const liveRef = useRef(false);
  const typeRef = useRef(false);
  const configRef = useRef(config);
  configRef.current = config;
  const nextId = useRef(1);
  /** Silent listening tries in a row (the browser stops listening after a few quiet seconds). */
  const quietTries = useRef(0);
  const [heardNothing, setHeardNothing] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Braces matter: newer browsers return a value from scrollIntoView, and an effect may only return a clean-up function.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [entries.length, phase]);
  useEffect(() => () => { liveRef.current = false; }, []);

  const setAll = (list: Entry[]) => {
    entriesRef.current = list;
    setEntries(list);
  };

  const valuesFor = () => {
    const out: Record<string, string> = {};
    for (const v of callVars) out[v.name] = callValues[v.name] ?? v.example ?? v.defaultValue ?? "";
    return out;
  };

  /** After the agent has spoken: listen for the caller (unless typing or the call ended). */
  const afterAgent = (endsCall: boolean) => {
    if (endsCall || !liveRef.current) {
      liveRef.current = false;
      setPhase("ended");
      return;
    }
    if (!typeRef.current && listener.supported) {
      listen();
    } else {
      setPhase("idle");
    }
  };

  /** Turn the microphone on; if nothing is heard, try again quietly up to three times. */
  function listen() {
    setHeardNothing(false);
    setPhase("listening");
    listener.listen(
      (text) => {
        quietTries.current = 0;
        void say(text);
      },
      () => {
        if (!liveRef.current || typeRef.current) return;
        quietTries.current += 1;
        if (quietTries.current < 3) listen();
        else {
          quietTries.current = 0;
          setHeardNothing(true);
          setPhase("idle");
        }
      },
    );
  }

  async function turn(event: SimulateInput["event"], before: Entry[]) {
    setPhase(event.type === "start" ? "connecting" : "thinking");
    const result = await talkToAgent({
      config: configRef.current,
      lead,
      callValues: valuesFor(),
      when,
      history: before.map((e) => (e.role === "agent" ? { role: "agent" as const, text: e.line.text } : { role: "caller" as const, text: e.text })),
      event,
    });
    if (!liveRef.current) return;
    if (!result.ok) {
      setErrors(result.errors);
      if (event.type === "start") {
        liveRef.current = false;
        setPhase("idle");
        if (result.errors.some((e) => /placeholder|value/i.test(e))) setShowSettings(true);
      } else {
        afterAgent(false);
      }
      return;
    }
    setErrors([]);
    if (result.callingWindow && !result.callingWindow.allowed) setOutsideHours(result.callingWindow.reason);
    const entry: Entry = { id: nextId.current++, role: "agent", line: result.line };
    setAll([...before, entry]);
    if (speakAloud && voice) {
      setPhase("speaking");
      await speaker.speak(voice.id, result.line.text, `line-${entry.id}`, configRef.current.voiceSettings);
    }
    afterAgent(result.line.endsCall);
  }

  async function say(raw: string) {
    const text = raw.trim();
    if (!text || !liveRef.current) return;
    speaker.stop();
    const withCaller: Entry[] = [...entriesRef.current, { id: nextId.current++, role: "caller", text: text.slice(0, 1000) }];
    setAll(withCaller);
    setDraft("");
    await turn({ type: "message", text: text.slice(0, 1000) }, withCaller);
  }

  const start = () => {
    speaker.stop();
    listener.stopListening();
    liveRef.current = true;
    setErrors([]);
    setOutsideHours(null);
    setAll([]);
    void turn({ type: "start" }, []);
  };

  const end = () => {
    liveRef.current = false;
    speaker.stop();
    listener.stopListening();
    setPhase("ended");
  };

  const toggleType = () => {
    const next = !typeMode;
    setTypeMode(next);
    typeRef.current = next;
    if (next) listener.stopListening();
    else if (liveRef.current && phase === "idle" && listener.supported) listen();
  };

  // In a call: anything but idle/ended, or idle while waiting for the caller to type.
  const live = (phase !== "idle" && phase !== "ended") || (phase === "idle" && entries.length > 0 && liveRef.current);
  const canType = live && (typeMode || !listener.supported);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary/60 to-primary font-semibold text-primary-foreground">{(config.name || "A")[0]}</span>
        <div className="min-w-0">
          <p className="truncate font-semibold">{config.name || "Your agent"}</p>
          <p className="truncate text-xs text-muted-foreground">
            {voice?.name ?? "No voice chosen"} · {provider === "mock" ? "demo replies (prompt not read)" : "real AI replies"}
          </p>
        </div>
      </div>

      {/* Conversation */}
      <div className={cn("space-y-2 text-sm", entries.length > 0 || phase !== "idle" ? "max-h-[min(24rem,50dvh)] min-h-32 overflow-y-auto rounded-xl border bg-muted/20 p-3" : "")}>
        {entries.length === 0 && phase === "idle" && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <button
              type="button"
              onClick={start}
              aria-label="Start talking"
              className="grid size-16 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_0_0_8px_color-mix(in_oklab,var(--color-primary)_12%,transparent)] transition-transform hover:scale-105"
            >
              <Mic className="size-7" />
            </button>
            <p className="max-w-64 text-xs text-muted-foreground">
              {config.name || "The agent"} speaks first, then just talk. Uses your latest changes, even unsaved.
            </p>
          </div>
        )}
        {entries.map((e) =>
          e.role === "agent" ? (
            <div key={e.id} className="max-w-[90%] space-y-1">
              <p className="rounded-2xl rounded-tl-sm bg-card px-3 py-2 shadow-xs">{e.line.text || <span className="italic text-muted-foreground">(no words, used a tool)</span>}</p>
              {e.line.toolCalls.length > 0 && (
                <p className="flex flex-wrap gap-1 text-[11px]">
                  {e.line.toolCalls.map((c, i) => (
                    <span key={i} className={cn("rounded-full px-2 py-0.5", c.ok ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive")}>
                      {c.tool.replace(/_/g, " ")}: {c.result}
                    </span>
                  ))}
                </p>
              )}
            </div>
          ) : (
            <p key={e.id} className="ml-auto w-fit max-w-[90%] rounded-2xl rounded-tr-sm bg-primary px-3 py-2 text-primary-foreground">{e.text}</p>
          ),
        )}
        {listener.interim && <p className="ml-auto w-fit max-w-[90%] rounded-2xl bg-primary/40 px-3 py-2 italic text-primary-foreground">{listener.interim}</p>}
        <div ref={bottomRef} />
      </div>

      {/* Status */}
      {phase !== "idle" && (
        <p className={cn("flex items-center justify-center gap-2 text-sm font-medium", phase === "listening" ? "text-primary" : "text-muted-foreground")}>
          {phase === "listening" && (level > 0 ? (
            <span className="flex h-4 items-end gap-[2px]" aria-hidden>
              {[0.6, 1, 0.8].map((k, i) => <span key={i} className="w-1 rounded-full bg-primary transition-all" style={{ height: `${Math.max(15, Math.min(100, level * 100 * k))}%` }} />)}
            </span>
          ) : <span className="size-2.5 animate-ping rounded-full bg-primary" />)}
          {(phase === "thinking" || phase === "connecting") && <Loader2 className="size-4 animate-spin" />}
          {phase === "speaking" && <Volume2 className="size-4" />}
          {PHASE_TEXT[phase]}
        </p>
      )}
      {outsideHours && <p className="text-center text-xs text-warning">A real call would be blocked now: {outsideHours}</p>}
      {listener.error && <p className="text-xs text-destructive">{listener.error}</p>}
      {speaker.error && <p className="text-xs text-destructive">{speaker.error}</p>}
      {errors.length > 0 && <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">{errors.join(" ")}</div>}
      {!listener.supported && <p className="text-xs text-muted-foreground">This browser cannot use the microphone. You can type instead.</p>}

      {heardNothing && live && !typeMode && (
        <Button type="button" variant="outline" className="w-full" onClick={() => listen()}>
          <Mic /> Didn&apos;t hear anything. Tap to talk
        </Button>
      )}
      {canType && (
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void say(draft); }}>
          <Input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={1000} placeholder="Type what the customer says…" aria-label="Type what the customer says" autoFocus />
          <Button type="submit" size="icon" disabled={!draft.trim() || phase === "thinking"} aria-label="Send"><Send /></Button>
        </form>
      )}

      {/* Main button */}
      {phase === "idle" && entries.length === 0 ? (
        <Button type="button" size="lg" className="w-full" onClick={start}><Mic /> Start talking</Button>
      ) : live ? (
        <Button type="button" size="lg" variant="outline" className="w-full text-destructive" onClick={end}><PhoneOff /> End call</Button>
      ) : (
        <Button type="button" size="lg" className="w-full" onClick={start}><Mic /> Talk again</Button>
      )}

      <div className="flex justify-between text-xs">
        <button type="button" onClick={() => setShowSettings((s) => !s)} className="inline-flex items-center gap-1 text-primary hover:underline"><Settings2 className="size-3.5" /> Call settings</button>
        {listener.supported && (
          <button type="button" onClick={toggleType} className="inline-flex items-center gap-1 text-primary hover:underline">
            {typeMode ? <><Mic className="size-3.5" /> Talk instead</> : <><Keyboard className="size-3.5" /> Type instead</>}
          </button>
        )}
      </div>

      {showSettings && (
        <fieldset disabled={live} className="space-y-3 rounded-lg border p-3 text-sm">
          <p className="text-xs text-muted-foreground">Details for this test call. Change these before starting.</p>
          {callVars.map((v) => (
            <div key={v.name} className="space-y-1">
              <Label htmlFor={`tp-${v.name}`}>{v.label}{v.required && <span className="text-destructive"> *</span>}</Label>
              <Input id={`tp-${v.name}`} value={callValues[v.name] ?? v.example ?? v.defaultValue ?? ""} onChange={(e) => setCallValues({ ...callValues, [v.name]: e.target.value })} />
            </div>
          ))}
          <div className="space-y-1"><Label htmlFor="tp-when">Call time (WAT)</Label><Input id="tp-when" type="datetime-local" value={when} onChange={(e) => e.target.value && setWhen(e.target.value)} /></div>
          <label className="flex items-center gap-2"><input type="checkbox" checked={speakAloud} disabled={!voice} onChange={(e) => setSpeakAloud(e.target.checked)} className="accent-[var(--color-primary)]" /> Speak the agent&apos;s lines aloud</label>
        </fieldset>
      )}
    </div>
  );
}
