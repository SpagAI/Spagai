"use client";

import { compilePrompt, estimateTokens, MAX_BLOCK_CHARS, SYSTEM_VARIABLES, type AgentConfig, type VariableDef } from "@spagai/core";
import { Braces, ChevronDown, Eraser, Lock, Plus, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
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
}: {
  config: AgentConfig;
  onChange: (next: AgentConfig) => void;
  onAddVariable: (v: VariableDef) => void;
  readOnly: boolean;
}) {
  const text = promptText(config);
  const ref = useRef<HTMLTextAreaElement>(null);
  const [showRules, setShowRules] = useState(false);
  const [valuesOpen, setValuesOpen] = useState(false);
  const valuesRef = useRef<HTMLDivElement>(null);
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
    if (!valuesOpen) return;
    const close = (e: MouseEvent) => !valuesRef.current?.contains(e.target as Node) && setValuesOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [valuesOpen]);

  const insert = (name: string) => {
    setValuesOpen(false);
    const el = ref.current;
    const token = `{{${name}}}`;
    const at = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? at;
    onChange(withPromptText(config, text.slice(0, at) + token + text.slice(end)));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(at + token.length, at + token.length);
    });
  };

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
