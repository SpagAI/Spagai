"use client";

import type { AgentConfig, VariableDef } from "@spagai/core";
import { ArrowLeft, CircleAlert, FlaskConical, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import { deleteAgent, saveAgent } from "@/app/(app)/agents/actions";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/i18n/client";
import { formatLagos } from "@/lib/format";
import { cn } from "@/lib/utils";
import { BlocksEditor } from "./blocks-editor";
import { KnowledgeTab, NumbersTab, SetupSteps, type AgentConnections } from "./connections";
import { PreviewPanel } from "./preview-panel";
import { BusinessTab, FirstMessageTab, SilenceTab, ToolsTab, VoiceTab } from "./tabs";

const TABS = ["business", "voice", "blocks", "firstMessage", "knowledge", "numbers", "tools", "silence"] as const;
type Tab = (typeof TABS)[number];

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
}

export function AgentBuilder({ agentId, initialConfig, initialStatus, updatedAt, readOnly, canDelete, connections, isNew }: AgentBuilderProps) {
  const t = useT();
  const [config, setConfig] = useState(initialConfig);
  const [saved, setSaved] = useState({ config: initialConfig, status: initialStatus, at: updatedAt });
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
  const update = useCallback((patch: Partial<AgentConfig>) => setConfig((c) => ({ ...c, ...patch })), []);
  const addVariable = useCallback(
    (v: VariableDef) => setConfig((c) => (c.variables.some((x) => x.name === v.name) ? c : { ...c, variables: [...c.variables, v] })),
    [],
  );

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const save = (status: "DRAFT" | "READY") =>
    startTransition(async () => {
      const result = await saveAgent(agentId, config, status);
      if (result.ok) {
        setConfig(result.config);
        setSaved({ config: result.config, status: result.status, at: result.savedAt });
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
          {pending ? t("builder.saving") : dirty ? t("builder.unsaved") : `${t("builder.saved")} ${formatLagos(saved.at)} WAT`}
        </span>
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
          <div role="tablist" className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0">
            {TABS.map((id) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={cn(
                  "shrink-0 rounded-md px-3 py-1.5 text-sm transition-colors",
                  tab === id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                {t(`builder.tabs.${id}`)}
              </button>
            ))}
          </div>

          <fieldset disabled={readOnly} className="min-w-0">
            {tab === "business" && <BusinessTab config={config} update={update} />}
            {tab === "blocks" && <BlocksEditor blocks={config.blocks} onChange={(blocks) => update({ blocks })} />}
            {tab === "firstMessage" && <FirstMessageTab config={config} update={update} />}
            {tab === "tools" && <ToolsTab config={config} update={update} />}
            {tab === "silence" && <SilenceTab config={config} update={update} />}
            {tab === "voice" && <VoiceTab config={config} update={update} />}
          </fieldset>
          {tab === "knowledge" && <KnowledgeTab agentId={agentId} c={connections} />}
          {tab === "numbers" && <NumbersTab agentId={agentId} c={connections} />}

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
