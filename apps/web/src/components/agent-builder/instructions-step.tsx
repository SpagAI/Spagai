"use client";

import { compilePrompt, estimateTokens, MAX_BLOCK_CHARS, SYSTEM_VARIABLES, type AgentConfig, type VariableDef } from "@spagai/core";
import { Eraser, Lock, Plus, TriangleAlert } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { promptText, withPromptText } from "@/lib/prompt-text";
import { sampleValues } from "./shared";

const GUARDRAIL_NAMES: Record<string, string> = {
  ai_disclosure: "Says it is an AI assistant",
  calling_hours: "Only calls between 8am and 9pm",
  opt_out: "Stops when someone asks not to be called",
  data_safety: "Never asks for PINs, OTPs, BVN or card numbers",
};

/** The one place the prompt lives. Templates arrive already filled in; everything is editable. */
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
  const guardrails = config.blocks.filter((b) => b.guardrail);

  // Values the person can drop in, and any {{name}} they typed that is not a value yet.
  const values = [...config.variables.filter((v) => v.scope === "agent" || v.scope === "call"), ...SYSTEM_VARIABLES.filter((v) => ["lead_name", "address", "greeting", "current_day"].includes(v.name))]
    .filter((v, i, all) => all.findIndex((x) => x.name === v.name) === i);
  const undeclared = useMemo(
    () => compilePrompt({ blocks: config.blocks, variables: config.variables, firstMessage: config.firstMessage }, { values: sampleValues(config), mode: "preview" }).variables.undeclared,
    [config],
  );
  const tokens = estimateTokens(text);

  const insert = (name: string) => {
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
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="prompt-box" className="text-sm font-semibold">Prompt</label>
          {!readOnly && text.length > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(withPromptText(config, ""))}>
              <Eraser /> Clear prompt
            </Button>
          )}
        </div>
        <Textarea
          id="prompt-box"
          ref={ref}
          value={text}
          maxLength={MAX_BLOCK_CHARS}
          readOnly={readOnly}
          onChange={(e) => onChange(withPromptText(config, e.target.value))}
          placeholder="Write what the agent should do on each call, in your own words, or paste a prompt you already have."
          className="min-h-[24rem] font-mono text-sm leading-relaxed"
        />
        <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
          <span>Changes are kept automatically. Undo (↶) brings back anything removed by mistake.</span>
          <span className="tabular-nums">
            {text.length.toLocaleString("en-NG")} / {MAX_BLOCK_CHARS.toLocaleString("en-NG")}
            {tokens > 3000 && " · long prompts can make replies slower"}
          </span>
        </div>
      </div>

      {undeclared.length > 0 && (
        <div className="space-y-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
          <p className="flex items-center gap-1.5 font-medium"><TriangleAlert className="size-4 text-warning" /> These are not values yet, so they would be read out as written:</p>
          <div className="flex flex-wrap gap-2">
            {undeclared.map((name) => (
              <Button key={name} type="button" size="sm" variant="outline" disabled={readOnly} onClick={() => onAddVariable({ name, label: name.replace(/_/g, " "), scope: "call", required: false })}>
                <Plus /> Make {`{{${name}}}`} a value
              </Button>
            ))}
          </div>
        </div>
      )}

      {!readOnly && values.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Insert a value (filled in on each call):</p>
          <div className="flex flex-wrap gap-1.5">
            {values.map((v) => (
              <button key={v.name} type="button" onClick={() => insert(v.name)} title={v.label} className="rounded-full border px-2.5 py-0.5 font-mono text-xs text-muted-foreground hover:border-primary/50 hover:text-foreground">
                {`{{${v.name}}}`}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-lg border bg-muted/30 p-3">
        <p className="flex items-center gap-1.5 text-sm font-medium"><Lock className="size-4 text-muted-foreground" /> Added to every agent automatically</p>
        <ul className="mt-1.5 grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
          {guardrails.map((g) => <li key={g.id}>• {GUARDRAIL_NAMES[g.guardrail!] ?? g.title}</li>)}
        </ul>
        <button type="button" onClick={() => setShowRules((s) => !s)} className="mt-2 text-xs text-primary hover:underline">
          {showRules ? "Hide the exact wording" : "Read the exact wording"}
        </button>
        {showRules && (
          <div className="mt-2 space-y-2">
            {guardrails.map((g) => (
              <div key={g.id} className="text-xs">
                <p className="font-medium">{g.title}</p>
                <p className="whitespace-pre-wrap text-muted-foreground">{g.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
