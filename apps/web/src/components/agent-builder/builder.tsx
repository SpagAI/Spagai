"use client";

import { orderVoices, type AgentConfig, type VariableDef, type Voice } from "@spagai/core";
import { ArrowLeft, AudioLines, BookOpen, Building2, CircleAlert, FlaskConical, MessageSquareText, Mic, History, Phone, Redo2, Save, ScrollText, Timer, Trash2, TriangleAlert, Undo2, Wrench, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { autosaveAgentDraft, deleteAgent, discardAgentDraft, saveAgent } from "@/app/(app)/agents/actions";
import { promptLength, record, redo, startHistory, undo, wasCleared } from "@/lib/agent-history";
import { VersionHistory } from "./version-history";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/i18n/client";
import { formatLagos } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Simulator } from "@/components/simulator/simulator";
import { BlocksEditor } from "./blocks-editor";
import { KnowledgeTab, NumbersTab, SetupSteps, type AgentConnections } from "./connections";
import { PreviewPanel } from "./preview-panel";
import { BusinessTab, FirstMessageTab, SilenceTab, ToolsTab, VoiceTab } from "./tabs";

const TABS = ["business", "voice", "blocks", "firstMessage", "knowledge", "numbers", "tools", "silence", "talk"] as const;
type Tab = (typeof TABS)[number];

/** Tabs in three groups, all visible (they wrap instead of scrolling out of sight). */
const TAB_GROUPS: { label: string; tabs: { id: Tab; icon: LucideIcon }[] }[] = [
  { label: "Set up", tabs: [{ id: "business", icon: Building2 }, { id: "voice", icon: AudioLines }, { id: "blocks", icon: ScrollText }, { id: "firstMessage", icon: MessageSquareText }] },
  { label: "Connect", tabs: [{ id: "knowledge", icon: BookOpen }, { id: "numbers", icon: Phone }, { id: "tools", icon: Wrench }, { id: "silence", icon: Timer }] },
  { label: "Test", tabs: [{ id: "talk", icon: Mic }] },
];

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
  const detailsFilled = saved.config.variables.filter((v) => v.scope === "agent" && v.required).every((v) => (saved.config.variableValues[v.name] ?? "").trim());
  const steps = [
    { key: "name", label: "Name & business", done: !!saved.config.name.trim() && detailsFilled, tab: "business" },
    { key: "voice", label: "Voice", done: !!saved.config.voiceId, tab: "voice" },
    { key: "prompt", label: "Instructions", done: saved.config.blocks.some((b) => !b.guardrail && b.content.trim().length > 40), tab: "blocks" },
    { key: "knowledge", label: "Knowledge base", done: connections.knowledge.length > 0, tab: "knowledge" },
    { key: "number", label: "Phone number", done: connections.numbers.length > 0, tab: "numbers" },
    { key: "lab", label: "Test in the Lab", done: connections.testedInLab, href: `/lab/${agentId}` },
  ];
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 basis-full items-center gap-2 sm:basis-auto">
          <Button asChild variant="ghost" size="icon" aria-label={t("common.back")}>
            <Link href="/agents"><ArrowLeft /></Link>
          </Button>
          <Input
            aria-label={t("builder.agentName")}
            value={config.name}
            disabled={readOnly}
            onChange={(e) => update({ name: e.target.value })}
            className="h-10 min-w-0 flex-1 text-lg font-semibold sm:w-72"
          />
        </div>
        <Badge variant={saved.status === "READY" ? "default" : "secondary"}>{t(`agents.status.${saved.status}`)}</Badge>
        <span className="text-xs text-muted-foreground">
          {pending
            ? t("builder.saving")
            : dirty
              ? `${t("builder.unsaved")} · ${draftState.status === "saving" ? "keeping a draft…" : draftState.status === "saved" && !unkept ? "draft kept" : draftState.status === "error" ? "draft not kept" : "draft in a moment"}`
              : `${t("builder.saved")} ${formatLagos(saved.at)} WAT`}
        </span>
        {!readOnly && (
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="icon" onClick={doUndo} disabled={!hist.past.length} aria-label="Undo" title="Undo (Ctrl+Z)"><Undo2 /></Button>
            <Button type="button" variant="ghost" size="icon" onClick={doRedo} disabled={!hist.future.length} aria-label="Redo" title="Redo (Ctrl+Shift+Z)"><Redo2 /></Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setHistoryOpen(true)}><History /> History</Button>
          </div>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link
              href={`/lab/${agentId}`}
              data-no-loader
              onClick={(e) => {
                if (dirty && !window.confirm(t("builder.testUnsaved"))) e.preventDefault();
              }}
            >
              <FlaskConical /> {t("builder.test")}
            </Link>
          </Button>
          {!readOnly && (
            <>
              {saved.status === "READY" ? (
                <Button type="button" variant="outline" disabled={pending} onClick={() => save("DRAFT")}>{t("builder.markDraft")}</Button>
              ) : (
                <Button type="button" variant="outline" disabled={pending} onClick={() => save("READY")}>{t("builder.markReady")}</Button>
              )}
              <Button type="button" disabled={pending || !dirty} onClick={() => save(saved.status)}>
                <Save /> {t("builder.save")}
              </Button>
            </>
          )}
        </div>
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
      {isNew && <Alert variant="success">Your agent is created. Work through the steps below: choose a voice, write its instructions, give it knowledge and a phone number, then test it in the Lab.</Alert>}
      <SetupSteps steps={steps} onPick={(id) => setTab(id as Tab)} />

      {readOnly && <Alert>{t("agents.readOnly")}</Alert>}
      {errors.length > 0 && (
        <Alert variant="destructive">
          <CircleAlert />
          <ul className="list-disc space-y-0.5 pl-6">
            {errors.map((e) => <li key={e}>{e}</li>)}
          </ul>
        </Alert>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,30rem)]">
        <div className="min-w-0 space-y-4">
          <div role="tablist" aria-label="Agent settings" className="flex flex-wrap gap-x-4 gap-y-3 rounded-xl border bg-card p-3">
            {TAB_GROUPS.map((group) => (
              <div key={group.label} className="min-w-0 space-y-1.5">
                <p className="px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{group.label}</p>
                <div className="flex flex-wrap gap-1.5">
                  {group.tabs.map(({ id, icon: Icon }) => (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={tab === id}
                      onClick={() => setTab(id)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
                        tab === id
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : id === "talk"
                            ? "border border-primary/40 bg-primary/5 text-primary hover:bg-primary/10"
                            : "bg-muted text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <Icon className="size-4" />
                      {t(`builder.tabs.${id}`)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <fieldset disabled={readOnly} className="min-w-0">
            {tab === "business" && <BusinessTab config={config} update={update} />}
            {tab === "blocks" && <BlocksEditor blocks={config.blocks} onChange={(blocks) => update({ blocks })} />}
            {tab === "firstMessage" && <FirstMessageTab config={config} update={update} />}
            {tab === "tools" && <ToolsTab config={config} update={update} />}
            {tab === "silence" && <SilenceTab config={config} update={update} />}
            {tab === "voice" && <VoiceTab config={config} update={update} workspaceVoices={workspaceVoices} />}
          </fieldset>
          {tab === "knowledge" && <KnowledgeTab agentId={agentId} c={connections} />}
          {tab === "numbers" && <NumbersTab agentId={agentId} c={connections} />}
          {tab === "talk" && (
            <Simulator
              embedded
              agentId={agentId}
              config={config}
              initialWhen={initialWhen}
              provider={llmProvider}
              voice={orderVoices(workspaceVoices).find((v) => v.id === config.voiceId)}
            />
          )}

          {canDelete && (
            <form
              action={deleteAgent}
              onSubmit={(e) => {
                if (!window.confirm(t("agents.deleteConfirm"))) e.preventDefault();
              }}
            >
              <input type="hidden" name="agentId" value={agentId} />
              <Button type="submit" variant="ghost" size="sm" className="text-destructive">
                <Trash2 /> {t("agents.delete")}
              </Button>
            </form>
          )}
        </div>

        <PreviewPanel config={config} onAddVariable={addVariable} readOnly={readOnly} />
      </div>
    </div>
  );
}
