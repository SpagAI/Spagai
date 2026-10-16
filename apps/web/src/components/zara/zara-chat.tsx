"use client";

import { ArrowUp, Bot, Check, ClipboardList, FlaskConical, Hammer, Loader2, Pencil, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { buildAgentFromPlan } from "@/app/(app)/home/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { draftPlan, languageName, refinePlan, soundsLikeARequest, SUGGESTIONS, wantsToBuild, type AgentPlan, type ZaraMode } from "@/lib/zara";

type Built = { agentId: string; name: string; ready: boolean; toFill: string[] };
type Message =
  | { id: number; role: "user"; text: string }
  | { id: number; role: "zara"; text: string; plan?: AgentPlan; built?: Built; error?: boolean };

const THINK_MS = 650;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function ZaraAvatar({ size = "size-8" }: { size?: string }) {
  return (
    <span className={cn("grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-[#8b5cf6] text-primary-foreground shadow-sm", size)} aria-hidden>
      <Sparkles className="size-[55%]" />
    </span>
  );
}

function ModeSwitch({ mode, onChange }: { mode: ZaraMode; onChange: (m: ZaraMode) => void }) {
  const options: { value: ZaraMode; label: string; icon: typeof Hammer; help: string }[] = [
    { value: "plan", label: "Plan", icon: ClipboardList, help: "Zara shows you a plan first. Nothing is built until you approve it." },
    { value: "build", label: "Build", icon: Hammer, help: "Zara builds the agent straight away. You can change everything afterwards." },
  ];
  return (
    <div role="radiogroup" aria-label="How Zara should work" className="inline-flex rounded-lg border bg-muted p-0.5">
      {options.map(({ value, label, icon: Icon, help }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={mode === value}
          title={help}
          onClick={() => onChange(value)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            mode === value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon className="size-3.5" /> {label}
        </button>
      ))}
    </div>
  );
}

function PlanCard({ plan, onBuild, onChange, building, built }: { plan: AgentPlan; onBuild: () => void; onChange: () => void; building: boolean; built: boolean }) {
  const greeting = plan.firstMessage.replaceAll("{{agent_name}}", plan.agentName).replaceAll("{{company_name}}", plan.company);
  const rows: [string, React.ReactNode][] = [
    ["Name", plan.agentName],
    ["Business", plan.company],
    ["Calls", plan.direction === "outbound" ? "Calls your customers (outbound)" : "Answers your incoming calls (inbound)"],
    ["Voice", `${plan.voiceName} · ${plan.voiceGender === "female" ? "female" : "male"} · ${languageName(plan.language)}`],
    ["What it does", plan.purpose],
    ["First words", <span key="g" className="italic">“{greeting}”</span>],
  ];
  return (
    <div className="mt-3 overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center justify-between gap-2 border-b bg-muted/50 px-4 py-2.5">
        <p className="flex items-center gap-2 text-sm font-semibold"><ClipboardList className="size-4 text-primary" /> Plan: {plan.useCase}</p>
        {plan.presetId && <span className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">Uses a ready-made template</span>}
      </div>
      <dl className="divide-y text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="grid gap-1 px-4 py-2.5 sm:grid-cols-[7.5rem_1fr]">
            <dt className="text-muted-foreground">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
        <div className="grid gap-1 px-4 py-2.5 sm:grid-cols-[7.5rem_1fr]">
          <dt className="text-muted-foreground">It can</dt>
          <dd><ul className="space-y-1">{plan.abilities.map((a) => <li key={a} className="flex items-start gap-1.5"><Check className="mt-0.5 size-3.5 shrink-0 text-primary" />{a}</li>)}</ul></dd>
        </div>
        <div className="grid gap-1 px-4 py-2.5 sm:grid-cols-[7.5rem_1fr]">
          <dt className="text-muted-foreground">After building</dt>
          <dd className="text-muted-foreground">
            You&apos;ll add {[...plan.toFill.map((x) => x.toLowerCase()), "files or your website for its knowledge base", "a phone number"].join(", ")}, then test it in the Lab.
          </dd>
        </div>
      </dl>
      {!built && (
        <div className="flex flex-wrap gap-2 border-t px-4 py-3">
          <Button type="button" size="sm" onClick={onBuild} disabled={building}>
            {building ? <Loader2 className="animate-spin" /> : <Hammer />} {building ? "Building…" : "Build this agent"}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onChange} disabled={building}><Pencil /> Change something</Button>
        </div>
      )}
    </div>
  );
}

function BuiltCard({ built }: { built: Built }) {
  return (
    <div className="mt-3 rounded-xl border border-primary/40 bg-primary/5 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold"><Bot className="size-4 text-primary" /> {built.name} is built {built.ready ? "and ready" : "as a draft"}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {built.toFill.length > 0 ? `Next, fill in ${built.toFill.map((x) => x.toLowerCase()).join(" and ")}, ` : "Next, "}
        add its knowledge and a phone number, then try a pretend call.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button asChild size="sm"><Link href={`/agents/${built.agentId}?new=1`}><Pencil /> Finish setting up</Link></Button>
        <Button asChild size="sm" variant="outline"><Link href={`/lab/${built.agentId}`}><FlaskConical /> Test in the Lab</Link></Button>
      </div>
    </div>
  );
}

export function ZaraChat({ firstName, company, canBuild, recent }: { firstName: string; company: string; canBuild: boolean; recent: { id: string; name: string }[] }) {
  const [mode, setMode] = useState<ZaraMode>("plan");
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [building, setBuilding] = useState(false);
  const plan = useRef<{ plan: AgentPlan; messageId: number; built: boolean } | null>(null);
  const ids = useRef(0);
  const input = useRef<HTMLTextAreaElement>(null);

  // Keep typing without clicking: the box moves when the chat starts, so put the cursor back.
  useEffect(() => {
    if (!thinking && !building) input.current?.focus({ preventScroll: true });
  }, [messages.length, thinking, building]);

  // Keep the newest message in view, above the message box that stays at the bottom.
  useEffect(() => {
    if (messages.length) window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
  }, [messages, thinking, building]);

  const say = (m: Omit<Extract<Message, { role: "zara" }>, "id" | "role">) => {
    const id = ++ids.current;
    setMessages((all) => [...all, { id, role: "zara", ...m }]);
    return id;
  };

  const build = async (p: AgentPlan) => {
    if (!canBuild) { say({ text: "Your role can look at agents but not create them. Ask an owner or admin of this workspace.", error: true }); return; }
    setBuilding(true);
    const result = await buildAgentFromPlan(p);
    setBuilding(false);
    if (!result.ok) { say({ text: result.message, error: true }); return; }
    if (plan.current) plan.current.built = true;
    say({ text: `All done! I've built ${result.name}.`, built: { agentId: result.agentId, name: result.name, ready: result.ready, toFill: p.toFill } });
  };

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text || thinking || building) return;
    setDraft("");
    setMessages((all) => [...all, { id: ++ids.current, role: "user", text }]);
    setThinking(true);
    await wait(THINK_MS);
    setThinking(false);

    const current = plan.current;
    // Changing a plan that has not been built yet.
    if (current && !current.built) {
      const { plan: next, changes } = refinePlan(current.plan, text);
      if (changes.length) {
        const id = say({ text: `Done, I ${changes.join(", ")}. Here's the updated plan.`, plan: next });
        plan.current = { plan: next, messageId: id, built: false };
        if (mode === "build" || wantsToBuild(text)) await build(next);
        return;
      }
      if (wantsToBuild(text)) { await build(current.plan); return; }
    }
    if (!soundsLikeARequest(text)) {
      say({ text: current && !current.built
        ? "Tell me what to change, for example “call her Ada”, “make it answer calls” or “use a male Pidgin voice”. When you're happy, say “build it”."
        : "I build voice agents for your business. Tell me what the agent should do, for example “remind my customers about repayments”, and I'll take it from there." });
      return;
    }
    // A new agent.
    const next = draftPlan(text, { company });
    if (mode === "plan") {
      const id = say({ text: `Here's my plan for a ${next.useCase.toLowerCase()} agent. Change anything by replying (e.g. “call him Tunde” or “make it inbound”), or build it when you're happy.`, plan: next });
      plan.current = { plan: next, messageId: id, built: false };
    } else {
      const id = say({ text: `Building a ${next.useCase.toLowerCase()} agent called ${next.agentName}…`, plan: next });
      plan.current = { plan: next, messageId: id, built: false };
      await build(next);
    }
  };

  const composer = (
    <form
      onSubmit={(e) => { e.preventDefault(); void send(draft); }}
      className="rounded-2xl border bg-card p-2 shadow-sm focus-within:border-primary/60 focus-within:ring-[3px] focus-within:ring-primary/15"
    >
      <textarea
        ref={input}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(draft); } }}
        rows={messages.length ? 2 : 3}
        maxLength={2000}
        placeholder={messages.length ? "Reply to Zara…" : "Describe the agent you need, e.g. “Call people who filled our website form and book a demo”"}
        aria-label="Message Zara"
        className="w-full resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
      />
      <div className="flex items-center justify-between gap-2 px-1">
        <ModeSwitch mode={mode} onChange={setMode} />
        <span className="hidden flex-1 truncate px-2 text-xs text-muted-foreground sm:block">
          {mode === "plan" ? "Zara plans first, you approve, then it builds." : "Zara builds straight away."}
        </span>
        <Button type="submit" size="icon" className="size-8 rounded-full" disabled={!draft.trim() || thinking || building} aria-label="Send">
          <ArrowUp />
        </Button>
      </div>
    </form>
  );

  if (messages.length === 0) {
    return (
      <div className="mx-auto flex min-h-[calc(100dvh-12rem)] max-w-3xl flex-col justify-center gap-6 py-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <ZaraAvatar size="size-12" />
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Hi {firstName}, what should Zara build for you?</h1>
          <p className="max-w-xl text-sm text-muted-foreground">Zara, our AI, turns a plain description into a working voice agent: name, voice, instructions and first words. Choose <span className="font-medium text-foreground">Plan</span> to review it first, or <span className="font-medium text-foreground">Build</span> to go straight ahead.</p>
        </div>
        {composer}
        <div className="flex flex-wrap justify-center gap-2">
          {SUGGESTIONS.map((s) => (
            <button key={s} type="button" onClick={() => void send(s)} className="rounded-full border bg-card px-3 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground">
              {s}
            </button>
          ))}
        </div>
        {recent.length > 0 && (
          <p className="text-center text-xs text-muted-foreground">
            Recently built:{" "}
            {recent.map((a, i) => <span key={a.id}>{i > 0 && " · "}<Link href={`/agents/${a.id}`} className="font-medium text-foreground hover:underline">{a.name}</Link></span>)}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-12rem)] max-w-3xl flex-col">
      <div className="flex items-center justify-between gap-2 border-b pb-3">
        <p className="flex items-center gap-2 text-sm font-semibold"><ZaraAvatar size="size-6" /> Zara</p>
        <button type="button" onClick={() => { setMessages([]); plan.current = null; }} className="text-xs text-muted-foreground hover:text-foreground hover:underline">New chat</button>
      </div>
      <ol className="flex-1 space-y-5 py-5" aria-live="polite">
        {messages.map((m) => m.role === "user" ? (
          <li key={m.id} className="flex justify-end">
            <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-foreground px-4 py-2 text-sm whitespace-pre-wrap text-background">{m.text}</p>
          </li>
        ) : (
          <li key={m.id} className="flex gap-3">
            <ZaraAvatar />
            <div className="min-w-0 flex-1 pt-1">
              <p className={cn("text-sm", m.error && "text-destructive")}>{m.text}</p>
              {m.plan && !m.built && (
                <PlanCard
                  plan={m.plan}
                  building={building}
                  built={plan.current?.messageId !== m.id || !!plan.current?.built || mode === "build"}
                  onBuild={() => void build(m.plan!)}
                  onChange={() => { setDraft(""); input.current?.focus(); }}
                />
              )}
              {m.built && <BuiltCard built={m.built} />}
            </div>
          </li>
        ))}
        {(thinking || building) && (
          <li className="flex gap-3">
            <ZaraAvatar />
            <p className="flex items-center gap-1.5 pt-1.5 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> {building ? "Zara is building your agent…" : "Zara is thinking…"}
            </p>
          </li>
        )}
      </ol>
      <div className="sticky bottom-4 bg-gradient-to-t from-background via-background pt-2">{composer}</div>
    </div>
  );
}
