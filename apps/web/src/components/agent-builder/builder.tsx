"use client";

import { compilePrompt, lintPrompt, orderVoices, type AgentConfig, type VariableDef, type Voice } from "@spagai/core";
import { ArrowLeft, Check, ChevronDown, CircleAlert, CircleCheck, CircleDot, FlaskConical, History, Mic, MoreHorizontal, Redo2, Save, Trash2, TriangleAlert, Undo2, X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { autosaveAgentDraft, deleteAgent, discardAgentDraft, saveAgent } from "@/app/(app)/agents/actions";
import { promptLength, record, redo, startHistory, undo, wasCleared } from "@/lib/agent-history";
import { VersionHistory } from "./version-history";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/i18n/client";
import { formatLagos } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { KnowledgeTab, NumbersTab, type AgentConnections } from "./connections";
import { InstructionsStep } from "./instructions-step";
import { TalkPanel } from "./talk-panel";
import { BusinessTab, FirstMessageTab, SilenceTab, ToolsTab, VoiceTab } from "./tabs";

const STEPS = [
  { id: "business", label: "Business details" },
  { id: "voice", label: "Voice" },
  { id: "instructions", label: "Instructions" },
  { id: "firstMessage", label: "First message" },
  { id: "knowledge", label: "Knowledge base" },
  { id: "numbers", label: "Phone number" },
] as const;
const ADVANCED = [
  { id: "tools", label: "Tools" },
  { id: "silence", label: "Silence" },
] as const;
type Tab = (typeof STEPS)[number]["id"] | (typeof ADVANCED)[number]["id"];

export interface AgentBuilderProps {
  agentId: string;
  initialConfig: AgentConfig;
  initialStatus: "DRAFT" | "READY";
  updatedAt: string;
  readOnly: boolean;
  canDelete: boolean;
  connections: AgentConnections;
  /** Just created: show a short welcome. */
  isNew?: boolean;
  /** Voices this workspace added from the Fish Audio voice bank. */
  workspaceVoices?: Voice[];
  /** For "Talk to agent": which AI brain answers ("mock" = demo replies) and the starting Lagos time. */
  llmProvider?: string;
  initialWhen?: string;
  /** Unsaved changes kept by autosave last time: the editor opens with them. */
  draft?: { config: AgentConfig; savedAt: string };
}

export function AgentBuilder({ agentId, initialConfig, initialStatus, updatedAt, readOnly, canDelete, connections, isNew, workspaceVoices = [], llmProvider = "mock", initialWhen = "2026-10-13T10:30", draft }: AgentBuilderProps) {
  const t = useT();
  // Undo/redo history; `config` is what is on screen now.
  const [hist, setHist] = useState(() => startHistory(draft?.config ?? initialConfig));
  const config = hist.present;
  const change = useCallback((fn: (c: AgentConfig) => AgentConfig, force = false) => setHist((h) => record(h, fn(h.present), Date.now(), force)), []);
  const [saved, setSaved] = useState({ config: initialConfig, status: initialStatus, at: updatedAt });
  // Autosave: the last version kept as a draft on the server, and when.
  const [autosaved, setAutosaved] = useState(() => JSON.stringify(draft?.config ?? initialConfig));
  const [draftState, setDraftState] = useState<{ status: "idle" | "saving" | "saved" | "error"; at?: string }>(draft ? { status: "saved", at: draft.savedAt } : { status: "idle" });
  const hasDraft = useRef(Boolean(draft));
  const [restoredNotice, setRestoredNotice] = useState<string | null>(draft ? draft.savedAt : null);
  const [clearedNotice, setClearedNotice] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [versionNotice, setVersionNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("business");
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  const dirty = JSON.stringify(config) !== JSON.stringify(saved.config);
  const [talkOpen, setTalkOpen] = useState(false);
  const deleteRef = useRef<HTMLFormElement>(null);

  // Problems to fix, each linked to the step where it is fixed.
  const deferred = useDeferredValue(config);
  const issues = useMemo<BuilderIssue[]>(() => {
    const compiled = compilePrompt({ blocks: deferred.blocks, variables: deferred.variables, firstMessage: deferred.firstMessage }, { values: deferred.variableValues, mode: "preview" });
    const out: BuilderIssue[] = [];
    if (compiled.variables.missingRequired.length) out.push({ message: `Fill in: ${compiled.variables.missingRequired.join(", ").replace(/_/g, " ")}.`, severity: "error", step: "business" });
    if (compiled.variables.undeclared.length) out.push({ message: `Not values yet: ${compiled.variables.undeclared.map((n) => `{{${n}}}`).join(", ")}.`, severity: "error", step: "instructions" });
    if (!deferred.voiceId) out.push({ message: "Choose a voice.", severity: "error", step: "voice" });
    const lint = lintPrompt({ prompt: compiled.prompt, firstMessage: compiled.firstMessage });
    for (const i of lint.issues) {
      if (i.severity === "info" || i.rule.startsWith("missing-")) continue;
      const inFirst = !!i.excerpt && deferred.firstMessage.includes(i.excerpt.slice(0, 20));
      out.push({ message: i.message, severity: i.severity === "error" ? "error" : "warning", step: inFirst ? "firstMessage" : "instructions" });
    }
    return out.slice(0, 12);
  }, [deferred]);

  // Deleting a prompt section is always its own undo step.
  const update = useCallback(
    (patch: Partial<AgentConfig>) => change((c) => ({ ...c, ...patch }), Boolean(patch.blocks) && patch.blocks!.length < hist.present.blocks.length),
    [change, hist.present.blocks.length],
  );
  const addVariable = useCallback(
    (v: VariableDef) => change((c) => (c.variables.some((x) => x.name === v.name) ? c : { ...c, variables: [...c.variables, v] })),
    [change],
  );
  const doUndo = useCallback(() => setHist(undo), []);
  const doRedo = useCallback(() => setHist(redo), []);

  // Spot a prompt that was suddenly emptied, and offer to undo it.
  const prevConfig = useRef(config);
  useEffect(() => {
    if (wasCleared(prevConfig.current, config)) setClearedNotice(true);
    // Text came back (undo, or typed again): the warning is no longer needed.
    else if (promptLength(config) >= 200) setClearedNotice(false);
    prevConfig.current = config;
  }, [config]);

  // Ctrl+Z / Ctrl+Shift+Z (Cmd on Mac) outside text boxes, which have their own undo for typing.
  useEffect(() => {
    if (readOnly) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "z") return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      e.preventDefault();
      if (e.shiftKey) doRedo();
      else doUndo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [readOnly, doUndo, doRedo]);

  // Autosave unsaved changes as a draft a moment after typing stops. The live agent is not touched.
  const configJson = JSON.stringify(config);
  useEffect(() => {
    if (readOnly || configJson === autosaved) return;
    if (!dirty) {
      // Back to exactly the saved version: the draft is not needed any more.
      if (hasDraft.current) void discardAgentDraft(agentId);
      hasDraft.current = false;
      setAutosaved(configJson);
      setDraftState({ status: "idle" });
      return;
    }
    const timer = setTimeout(async () => {
      setDraftState((d) => ({ ...d, status: "saving" }));
      const result = await autosaveAgentDraft(agentId, JSON.parse(configJson));
      if (result.ok) {
        hasDraft.current = true;
        setAutosaved(configJson);
        setDraftState({ status: "saved", at: result.savedAt });
      } else {
        setDraftState({ status: "error" });
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [configJson, autosaved, dirty, readOnly, agentId]);

  // Warn before leaving only if the latest changes are not kept yet.
  const unkept = dirty && configJson !== autosaved;
  useEffect(() => {
    if (!unkept) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [unkept]);

  const discardDraft = () => {
    void discardAgentDraft(agentId);
    hasDraft.current = false;
    change(() => saved.config, true);
    setAutosaved(JSON.stringify(saved.config));
    setDraftState({ status: "idle" });
    setRestoredNotice(null);
  };

  const save = (status: "DRAFT" | "READY") =>
    startTransition(async () => {
      const result = await saveAgent(agentId, config, status);
      if (result.ok) {
        setHist((h) => ({ ...h, present: result.config }));
        setSaved({ config: result.config, status: result.status, at: result.savedAt });
        // Saving removes the draft on the server.
        hasDraft.current = false;
        setAutosaved(JSON.stringify(result.config));
        setDraftState({ status: "idle" });
        setRestoredNotice(null);
        setVersionNotice(null);
        setErrors([]);
      } else {
        setErrors(result.errors);
      }
    });

  const voice = orderVoices(workspaceVoices).find((v) => v.id === config.voiceId);
  const go = (id: Tab) => {
    setTab(id);
    requestAnimationFrame(() => document.getElementById("builder-step")?.scrollIntoView({ block: "start", behavior: "smooth" }));
  };
  const saveText = pending
    ? t("builder.saving")
    : dirty
      ? draftState.status === "saving" ? "Keeping your changes…" : draftState.status === "saved" && !unkept ? "Changes kept · not live until you save" : draftState.status === "error" ? "Changes not kept yet" : "Unsaved changes"
      : `All changes saved`;

  return (
    <div className="space-y-3">
      {/* Top bar: one row, flush under the page header */}
      <div className="sticky top-0 z-20 -mx-4 -mt-6 flex flex-wrap items-center gap-2 border-b bg-background/95 px-4 py-2 backdrop-blur lg:-mx-8 lg:-mt-8 lg:px-8">
        <Button asChild variant="ghost" size="icon" aria-label={t("common.back")}>
          <Link href="/agents"><ArrowLeft /></Link>
        </Button>
        <Input
          aria-label={t("builder.agentName")}
          value={config.name}
          disabled={readOnly}
          onChange={(e) => update({ name: e.target.value })}
          className="h-9 w-auto min-w-12 max-w-56 border-transparent px-2 text-lg font-semibold shadow-none [field-sizing:content] hover:border-input focus-visible:border-input"
        />
        {/* A status, not a button: a dot and words, no solid fill. */}
        <span
          title={saved.status === "READY" ? "This agent is live and can make calls. Change it under More." : "This agent is a draft and cannot make calls yet. Change it under More."}
          className={cn(
            "inline-flex items-center gap-1.5 text-xs font-medium",
            saved.status === "READY" ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground",
          )}
        >
          <span className={cn("size-2 rounded-full", saved.status === "READY" ? "bg-emerald-500" : "bg-muted-foreground/50")} />
          {saved.status === "READY" ? "Live: Ready" : t("agents.status.DRAFT")}
        </span>
        <span className="hidden items-center gap-1 text-xs text-muted-foreground md:inline-flex">
          {!dirty && !pending && <Check className="size-3.5" />} {saveText}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <IssuesButton issues={issues} onGo={(step) => go(step)} />
          {!readOnly && (
            <>
              <Button type="button" variant="ghost" size="icon" onClick={doUndo} disabled={!hist.past.length} aria-label="Undo" title="Undo (Ctrl+Z)"><Undo2 /></Button>
              <Button type="button" variant="ghost" size="icon" onClick={doRedo} disabled={!hist.future.length} aria-label="Redo" title="Redo (Ctrl+Shift+Z)"><Redo2 /></Button>
            </>
          )}
          <MoreMenu
            items={[
              ...(!readOnly
                ? [saved.status === "READY"
                    ? { label: t("builder.markDraft"), icon: CircleDot, onClick: () => save("DRAFT") }
                    : { label: t("builder.markReady"), icon: CircleCheck, onClick: () => save("READY") }]
                : []),
              { label: "Version history", icon: History, onClick: () => setHistoryOpen(true) },
              { label: "Open the full Lab", icon: FlaskConical, href: `/lab/${agentId}` },
              ...(canDelete ? [{ label: t("agents.delete"), icon: Trash2, danger: true, onClick: () => { if (window.confirm(t("agents.deleteConfirm"))) deleteRef.current?.requestSubmit(); } }] : []),
            ]}
          />
          {!readOnly && (
            <Button type="button" disabled={pending || !dirty} onClick={() => save(saved.status)}>
              <Save /> {t("builder.save")}
            </Button>
          )}
        </div>
        {canDelete && (
          <form ref={deleteRef} action={deleteAgent} className="hidden">
            <input type="hidden" name="agentId" value={agentId} />
          </form>
        )}
      </div>

      {restoredNotice && dirty && (
        <Alert>
          <History />
          <span>
            We brought back your unsaved changes from {formatLagos(restoredNotice)} WAT. They are not live until you press Save.{" "}
            <button type="button" onClick={discardDraft} className="font-medium underline underline-offset-2">Discard them</button>
          </span>
        </Alert>
      )}
      {clearedNotice && (
        <Alert variant="destructive">
          <TriangleAlert />
          <span>
            The prompt was just cleared.{" "}
            <button type="button" onClick={() => { doUndo(); setClearedNotice(false); }} className="font-medium underline underline-offset-2">Undo</button>
            {" "}·{" "}
            <button type="button" onClick={() => setClearedNotice(false)} className="underline underline-offset-2">Keep it cleared</button>
          </span>
        </Alert>
      )}
      {versionNotice && (
        <Alert variant="success">
          <History />
          <span>Restored the version from {formatLagos(versionNotice)} WAT. Press Save to keep it, or Undo to go back.</span>
        </Alert>
      )}
      {historyOpen && (
        <VersionHistory
          agentId={agentId}
          onClose={() => setHistoryOpen(false)}
          onRestore={(c, at) => {
            change(() => c, true);
            setVersionNotice(at);
            setHistoryOpen(false);
          }}
        />
      )}
      {isNew && <Alert variant="success">Your agent is created. Open any tab to change it, in any order, and press Start talking to hear it at any time.</Alert>}
      {readOnly && <Alert>{t("agents.readOnly")}</Alert>}
      {errors.length > 0 && (
        <Alert variant="destructive">
          <CircleAlert />
          <ul className="list-disc space-y-0.5 pl-6">
            {errors.map((e) => <li key={e}>{e}</li>)}
          </ul>
        </Alert>
      )}

      {/* Tabs across the top, in any order (they wrap, never cut off). Phones get a dropdown. */}
      <nav aria-label="Agent settings" role="tablist" className="hidden flex-wrap items-end border-b lg:flex">
        {STEPS.map((x) => (
          <StepLink key={x.id} label={x.label} active={tab === x.id} onClick={() => go(x.id)} />
        ))}
        <AdvancedMenu active={ADVANCED.find((x) => x.id === tab)?.label} onPick={(id) => go(id)} />
      </nav>
      <div className="lg:hidden">
        <Select aria-label="Agent settings" value={tab} onChange={(e) => go(e.target.value as Tab)}>
          {STEPS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
          <optgroup label="Advanced">{ADVANCED.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</optgroup>
        </Select>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_21rem]">
        {/* The one section being edited */}
        <div id="builder-step" className="min-w-0 scroll-mt-16 space-y-4">
          <fieldset disabled={readOnly} className="min-w-0">
            {tab === "business" && <BusinessTab config={config} update={update} />}
            {tab === "voice" && <VoiceTab config={config} update={update} workspaceVoices={workspaceVoices} />}
            {tab === "instructions" && (
              <Card>
                <CardHeader>
                  <CardTitle>Instructions</CardTitle>
                  <CardDescription>What the agent should do on each call. Templates arrive already written: change anything, or clear it and write your own.</CardDescription>
                </CardHeader>
                <CardContent>
                  <InstructionsStep config={config} onChange={(c) => change(() => c)} onAddVariable={addVariable} readOnly={readOnly} />
                </CardContent>
              </Card>
            )}
            {tab === "firstMessage" && <FirstMessageTab config={config} update={update} />}
            {tab === "tools" && <ToolsTab config={config} update={update} />}
            {tab === "silence" && <SilenceTab config={config} update={update} />}
          </fieldset>
          {tab === "knowledge" && <KnowledgeTab agentId={agentId} c={connections} />}
          {tab === "numbers" && <NumbersTab agentId={agentId} c={connections} />}

        </div>

        {/* Test your agent: always there on wide screens */}
        <aside aria-label="Test your agent" className="hidden h-[calc(100dvh-5.5rem)] min-h-[30rem] flex-col rounded-xl border bg-card p-4 xl:sticky xl:top-16 xl:flex">
          <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Test your agent</p>
          <TalkPanel config={config} voice={voice} provider={llmProvider} initialWhen={initialWhen} />
        </aside>
      </div>

      {/* Smaller screens: a button that opens the test panel full screen */}
      <button
        type="button"
        onClick={() => setTalkOpen(true)}
        className="fixed right-4 bottom-4 z-30 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 font-semibold text-primary-foreground shadow-lg xl:hidden"
      >
        <Mic className="size-5" /> Talk to {config.name || "agent"}
      </button>
      {talkOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background p-4 xl:hidden" role="dialog" aria-modal="true" aria-label="Test your agent">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold">Test your agent</p>
            <Button type="button" variant="ghost" size="icon" onClick={() => setTalkOpen(false)} aria-label="Close"><X /></Button>
          </div>
          <TalkPanel config={config} voice={voice} provider={llmProvider} initialWhen={initialWhen} />
        </div>
      )}
    </div>
  );
}

/** A tab. Tabs can be opened in any order; nothing has to be "done" first. */
function StepLink({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "-mb-px shrink-0 border-b-2 px-3 py-2.5 text-sm whitespace-nowrap transition-colors",
        active ? "border-primary font-semibold text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

/** Tools and Silence: less used, so they sit behind one small button. */
function AdvancedMenu({ active, onPick }: { active?: string; onPick: (id: Tab) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn("-mb-px flex items-center gap-1 border-b-2 px-3 py-2.5 text-sm whitespace-nowrap transition-colors", active ? "border-primary font-semibold text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
      >
        {active ? `Advanced: ${active}` : "Advanced"} <ChevronDown className="size-3.5" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-40 mt-1 w-56 rounded-lg border bg-popover p-1 shadow-lg">
          {ADVANCED.map((x) => (
            <button key={x.id} role="menuitem" type="button" onClick={() => { setOpen(false); onPick(x.id); }} className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted">
              <span className="font-medium">{x.label}</span>
              <span className="block text-xs text-muted-foreground">{x.id === "tools" ? "Booking, saving answers, ending the call" : "What happens when the line goes quiet"}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

type MenuItem = { label: string; icon: LucideIcon; onClick?: () => void; href?: string; danger?: boolean };

function MoreMenu({ items }: { items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <Button type="button" variant="outline" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu"><MoreHorizontal /> More</Button>
      {open && (
        <div role="menu" className="absolute right-0 z-40 mt-1 w-56 rounded-lg border bg-popover p-1 shadow-lg">
          {items.map((item) => {
            const cls = cn("flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-muted", item.danger && "text-destructive");
            const body = <><item.icon className="size-4" /> {item.label}</>;
            return item.href ? (
              <Link key={item.label} role="menuitem" href={item.href} className={cls} onClick={() => setOpen(false)}>{body}</Link>
            ) : (
              <button key={item.label} role="menuitem" type="button" className={cls} onClick={() => { setOpen(false); item.onClick?.(); }}>{body}</button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export interface BuilderIssue {
  message: string;
  severity: "error" | "warning";
  step: Tab;
}

function IssuesButton({ issues, onGo }: { issues: BuilderIssue[]; onGo: (step: Tab) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  if (!issues.length) return null;
  const errors = issues.filter((i) => i.severity === "error").length;
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold", errors ? "border-destructive/40 bg-destructive/5 text-destructive" : "border-warning/40 bg-warning/10 text-warning")}
      >
        <TriangleAlert className="size-3.5" /> {issues.length} {issues.length === 1 ? "issue" : "issues"}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-1 w-80 space-y-1 rounded-lg border bg-popover p-2 shadow-lg">
          <p className="px-1 text-xs text-muted-foreground">Fix these before the agent goes live:</p>
          {issues.map((issue, i) => (
            <button key={i} type="button" onClick={() => { setOpen(false); onGo(issue.step); }} className="flex w-full gap-2 rounded-md p-2 text-left text-sm hover:bg-muted">
              <TriangleAlert className={cn("mt-0.5 size-4 shrink-0", issue.severity === "error" ? "text-destructive" : "text-warning")} />
              <span>{issue.message} <span className="text-primary">Fix →</span></span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
