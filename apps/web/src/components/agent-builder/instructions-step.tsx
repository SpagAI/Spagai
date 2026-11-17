"use client";

import { compilePrompt, estimateTokens, MAX_BLOCK_CHARS, SYSTEM_VARIABLES, type AgentConfig, type VariableDef } from "@spagai/core";
import { Braces, ChevronDown, Eraser, Lock, Plus, TriangleAlert, Wrench } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { DEFAULT_TOOLS } from "@/lib/custom-tools";
import { promptText, withPromptText } from "@/lib/prompt-text";
import { sampleValues } from "./shared";

const GUARDRAIL_NAMES: Record<string, string> = {
  ai_disclosure: "Says it is an AI assistant",
  calling_hours: "Only calls between 8am and 9pm",
  opt_out: "Stops when someone asks not to be called",
  data_safety: "Never asks for PINs, OTPs, BVN or card numbers",
};

/** The one place the prompt lives: one large editor. Templates arrive already filled in. */
export function InstructionsStep({
  config,
  onChange,
  onAddVariable,
  readOnly,
  tools = [],
  mcpTools = [],
  onOpenTools,
}: {
  config: AgentConfig;
  onChange: (next: AgentConfig) => void;
  onAddVariable: (v: VariableDef) => void;
  readOnly: boolean;
  /** The workspace's own tools, to drop into the prompt by name. */
  tools?: { name: string; label: string; description: string }[];
  /** Allowed tools from connected MCP servers ("server__tool" names). */
  mcpTools?: { name: string; label: string; description: string }[];
  /** Go to the Tools tab (to create a tool). */
  onOpenTools?: () => void;
}) {
  const text = promptText(config);
  const ref = useRef<HTMLTextAreaElement>(null);
  const [showRules, setShowRules] = useState(false);
  const [valuesOpen, setValuesOpen] = useState(false);
  const valuesRef = useRef<HTMLDivElement>(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const toolsRef = useRef<HTMLDivElement>(null);
  const guardrails = config.blocks.filter((b) => b.guardrail);

  // Values the person can drop in, and any {{name}} they typed that is not a value yet.
  const values = [...config.variables.filter((v) => v.scope === "agent" || v.scope === "call"), ...SYSTEM_VARIABLES.filter((v) => ["lead_name", "address", "greeting", "current_day"].includes(v.name))]
    .filter((v, i, all) => all.findIndex((x) => x.name === v.name) === i);
  const undeclared = useMemo(
    () => compilePrompt({ blocks: config.blocks, variables: config.variables, firstMessage: config.firstMessage, direction: config.direction }, { values: sampleValues(config), mode: "preview" }).variables.undeclared,
    [config],
  );
  const tokens = estimateTokens(text);

  useEffect(() => {
    if (!valuesOpen && !toolsOpen) return;
    const close = (e: MouseEvent) => {
      if (!valuesRef.current?.contains(e.target as Node)) setValuesOpen(false);
      if (!toolsRef.current?.contains(e.target as Node)) setToolsOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [valuesOpen, toolsOpen]);

  /** Put text where the cursor is (replacing any selection). `extra` changes the agent at the same time. */
  const insertText = (token: string, extra: Partial<AgentConfig> = {}) => {
    setValuesOpen(false);
    setToolsOpen(false);
    const el = ref.current;
    const at = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? at;
    onChange({ ...withPromptText(config, text.slice(0, at) + token + text.slice(end)), ...extra });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(at + token.length, at + token.length);
    });
  };
  const insert = (name: string) => insertText(`{{${name}}}`);
  /** A tool goes in by name; one of your own tools is switched on for this agent if it was not. */
  const insertTool = (name: string, custom: boolean) =>
    insertText(name, custom && !config.customTools.includes(name) ? { customTools: [...config.customTools, name] } : {});
  const insertMcpTool = (name: string) => insertText(name, config.mcpTools.includes(name) ? {} : { mcpTools: [...config.mcpTools, name] });

  return (
    <div className="space-y-3">
      {/* One frame: a slim toolbar, then the editor filling the screen. */}
      <div className="overflow-hidden rounded-xl border bg-card shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/30">
        <div className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-4 py-2">
          <label htmlFor="prompt-box" className="font-semibold">Prompt</label>
          <span className="text-xs tabular-nums text-muted-foreground">
            {text.length.toLocaleString("en-NG")} / {MAX_BLOCK_CHARS.toLocaleString("en-NG")} characters
            {tokens > 3000 && " · long prompts can make replies slower"}
          </span>
          <div className="ml-auto flex items-center gap-1">
            {!readOnly && values.length > 0 && (
              <div ref={valuesRef} className="relative">
                <Button type="button" variant="ghost" size="sm" onClick={() => setValuesOpen((o) => !o)} aria-expanded={valuesOpen} aria-haspopup="menu">
                  <Braces /> Insert value <ChevronDown className="size-3.5" />
                </Button>
                {valuesOpen && (
                  <div role="menu" className="absolute right-0 z-30 mt-1 max-h-72 w-72 overflow-y-auto rounded-lg border bg-popover p-1 shadow-lg">
                    <p className="px-2 py-1 text-xs text-muted-foreground">Filled in on each call:</p>
                    {values.map((v) => (
                      <button key={v.name} role="menuitem" type="button" onClick={() => insert(v.name)} className="w-full rounded-md px-2 py-1.5 text-left hover:bg-muted">
                        <span className="font-mono text-xs">{`{{${v.name}}}`}</span>
                        <span className="block text-xs text-muted-foreground">{v.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {!readOnly && (
              <div ref={toolsRef} className="relative">
                <Button type="button" variant="ghost" size="sm" onClick={() => setToolsOpen((o) => !o)} aria-expanded={toolsOpen} aria-haspopup="menu">
                  <Wrench /> Insert tool <ChevronDown className="size-3.5" />
                </Button>
                {toolsOpen && (
                  <div role="menu" aria-label="Insert tool" className="absolute right-0 z-30 mt-1 max-h-80 w-80 overflow-y-auto rounded-lg border bg-popover p-1 shadow-lg">
                    <p className="px-2 py-1 text-xs text-muted-foreground">Default (always on):</p>
                    {DEFAULT_TOOLS.map((t) => (
                      <button key={t.name} role="menuitem" type="button" onClick={() => insertTool(t.name, false)} className="w-full rounded-md px-2 py-1.5 text-left hover:bg-muted">
                        <span className="block text-sm font-medium">{t.label}</span>
                        <code className="block font-mono text-xs text-muted-foreground">{t.name}</code>
                        <span className="block text-xs text-muted-foreground">{t.description}</span>
                      </button>
                    ))}
                    <p className="mt-1 border-t px-2 pt-2 pb-1 text-xs text-muted-foreground">Your tools:</p>
                    {tools.length === 0 && <p className="px-2 py-1.5 text-xs text-muted-foreground">No tools yet.</p>}
                    {tools.map((t) => {
                      const on = config.customTools.includes(t.name);
                      return (
                        <button key={t.name} role="menuitem" type="button" onClick={() => insertTool(t.name, true)} className="w-full rounded-md px-2 py-1.5 text-left hover:bg-muted">
                          <span className="flex items-center gap-2 text-sm font-medium">
                            <span className="truncate">{t.label}</span>
                            <span className={on ? "ml-auto shrink-0 text-[11px] font-normal text-emerald-600 dark:text-emerald-400" : "ml-auto shrink-0 text-[11px] font-normal text-muted-foreground"}>{on ? "On" : "Will be switched on"}</span>
                          </span>
                          <code className="block font-mono text-xs text-muted-foreground">{t.name}</code>
                          <span className="line-clamp-2 block text-xs text-muted-foreground">{t.description}</span>
                        </button>
                      );
                    })}
                    {mcpTools.length > 0 && <p className="mt-1 border-t px-2 pt-2 pb-1 text-xs text-muted-foreground">From MCP servers:</p>}
                    {mcpTools.map((t) => {
                      const on = config.mcpTools.includes(t.name);
                      return (
                        <button key={t.name} role="menuitem" type="button" onClick={() => insertMcpTool(t.name)} className="w-full rounded-md px-2 py-1.5 text-left hover:bg-muted">
                          <span className="flex items-center gap-2 text-sm font-medium">
                            <span className="truncate">{t.label}</span>
                            <span className={on ? "ml-auto shrink-0 text-[11px] font-normal text-emerald-600 dark:text-emerald-400" : "ml-auto shrink-0 text-[11px] font-normal text-muted-foreground"}>{on ? "On" : "Will be switched on"}</span>
                          </span>
                          <code className="block font-mono text-xs text-muted-foreground">{t.name}</code>
                          {t.description && <span className="line-clamp-2 block text-xs text-muted-foreground">{t.description}</span>}
                        </button>
                      );
                    })}
                    {onOpenTools && (
                      <button type="button" role="menuitem" onClick={() => { setToolsOpen(false); onOpenTools(); }} className="mt-1 flex w-full items-center gap-1.5 rounded-md border-t px-2 pt-2 pb-1.5 text-left text-sm text-primary hover:bg-muted">
                        <Plus className="size-3.5" /> Create a new tool
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
            {!readOnly && text.length > 0 && (
              <Button type="button" variant="ghost" size="sm" onClick={() => onChange(withPromptText(config, ""))}>
                <Eraser /> Clear prompt
              </Button>
            )}
          </div>
        </div>
        <textarea
          id="prompt-box"
          ref={ref}
          value={text}
          maxLength={MAX_BLOCK_CHARS}
          readOnly={readOnly}
          onChange={(e) => onChange(withPromptText(config, e.target.value))}
          placeholder="Write what the agent should know and do on each call, in your own words, or paste a prompt you already have."
          spellCheck
          className="block h-[calc(100dvh-17rem)] min-h-[26rem] w-full resize-y bg-transparent px-5 py-4 text-[15px] leading-7 outline-none placeholder:text-muted-foreground"
        />
      </div>

      {undeclared.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
          <TriangleAlert className="size-4 shrink-0 text-warning" />
          <span>Not values yet, so they would be read out as written:</span>
          {undeclared.map((name) => (
            <Button key={name} type="button" size="sm" variant="outline" disabled={readOnly} onClick={() => onAddVariable({ name, label: name.replace(/_/g, " "), scope: "call", required: false })}>
              <Plus /> Make {`{{${name}}}`} a value
            </Button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Lock className="size-3.5" /> {guardrails.length} safety rules are added to every agent automatically.
          <button type="button" onClick={() => setShowRules((s) => !s)} className="text-primary hover:underline">{showRules ? "Hide" : "View"}</button>
        </span>
        <span>Changes are kept automatically. Undo (↶) brings back anything removed by mistake.</span>
      </div>
      {showRules && (
        <ul className="space-y-2 rounded-lg border bg-muted/30 p-3 text-xs">
          {guardrails.map((g) => (
            <li key={g.id}>
              <p className="font-medium">{GUARDRAIL_NAMES[g.guardrail!] ?? g.title}</p>
              <p className="whitespace-pre-wrap text-muted-foreground">{g.content}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
