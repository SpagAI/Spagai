"use client";

import { findVariables, SYSTEM_VARIABLES, type AgentConfig, type VariableDef } from "@spagai/core";
import { ArrowLeftRight, Plus, Search, TriangleAlert, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type Update = (patch: Partial<AgentConfig>) => void;

/** Filled from the test person / lead, never typed in. */
export const FROM_LEAD = new Set(["lead_name", "first_name", "last_name", "title", "gender", "address", "suffix", "full_name", "name"]);

const nameRe = /^[a-z][a-z0-9_]{0,39}$/;
const pretty = (name: string) => name.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

/** Placeholders used in the first message or prompt. */
function usedNames(config: AgentConfig): Set<string> {
  return new Set([config.firstMessage, ...config.blocks.map((b) => b.content)].flatMap((t) => findVariables(t)));
}

/**
 * One place for every {{placeholder}}: business details (saved with the agent), per-call values
 * (different on each call; typed here only for testing), ones filled in automatically, and any
 * the prompt uses that are not set up yet.
 */
export function VariablesTab({
  config,
  update,
  testValues,
  onTestValues,
}: {
  config: AgentConfig;
  update: Update;
  testValues: Record<string, string>;
  onTestValues: (values: Record<string, string>) => void;
}) {
  const [query, setQuery] = useState("");
  const used = useMemo(() => usedNames(config), [config]);
  const declared = new Set([...config.variables.map((v) => v.name), ...SYSTEM_VARIABLES.map((v) => v.name)]);
  const notSetUp = [...used].filter((n) => !declared.has(n) && !FROM_LEAD.has(n));
  const business = config.variables.filter((v) => v.scope === "agent");
  const perCall = config.variables.filter((v) => v.scope === "call" && !FROM_LEAD.has(v.name));
  const auto = [...SYSTEM_VARIABLES, ...config.variables.filter((v) => v.scope === "call" && FROM_LEAD.has(v.name))].filter((v, i, all) => all.findIndex((x) => x.name === v.name) === i);

  const match = (v: VariableDef) => !query || `${v.name} ${v.label}`.toLowerCase().includes(query.toLowerCase());
  const missingBusiness = business.filter((v) => v.required && !(config.variableValues[v.name] ?? "").trim()).length;
  const missingTest = perCall.filter((v) => v.required && !v.allowEmpty && !(testValues[v.name] ?? v.example ?? v.defaultValue ?? "").trim()).length;

  const addAll = (names: string[], scope: "agent" | "call") =>
    update({ variables: [...config.variables, ...names.filter((n) => !declared.has(n)).map((n): VariableDef => ({ name: n, label: pretty(n), scope, required: false }))] });
  const setScope = (name: string, scope: "agent" | "call") => update({ variables: config.variables.map((v) => (v.name === name ? { ...v, scope } : v)) });
  const remove = (name: string) => update({ variables: config.variables.filter((v) => v.name !== name) });

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1.5">
            <CardTitle>Variables</CardTitle>
            <CardDescription>Placeholders like <code className="font-mono">{"{{company_name}}"}</code> in your first message and prompt, all in one place.</CardDescription>
          </div>
          {config.variables.length + auto.length > 10 && (
            <div className="relative w-full sm:w-56">
              <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a variable" className="h-8 pl-8 text-sm" aria-label="Find a variable" />
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5 text-xs">
          <Chip>{business.length} business detail{business.length === 1 ? "" : "s"}</Chip>
          <Chip>{perCall.length} per-call value{perCall.length === 1 ? "" : "s"}</Chip>
          <Chip>{auto.length} automatic</Chip>
          {missingBusiness + missingTest > 0 && <Chip tone="warn">{missingBusiness + missingTest} missing</Chip>}
          {notSetUp.length > 0 && <Chip tone="bad">{notSetUp.length} not set up</Chip>}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {notSetUp.length > 0 && (
          <div className="space-y-2 rounded-lg border border-warning/50 bg-warning/5 p-3">
            <p className="flex items-center gap-1.5 text-sm font-medium"><TriangleAlert className="size-4 text-warning" /> Used in your prompt but not set up yet</p>
            <div className="flex flex-wrap gap-1">
              {notSetUp.map((n) => <code key={n} className="rounded bg-background px-1.5 py-0.5 font-mono text-xs">{`{{${n}}}`}</code>)}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => addAll(notSetUp, "call")}>Add all as per-call values</Button>
              <Button size="sm" variant="outline" onClick={() => addAll(notSetUp, "agent")}>Add all as business details</Button>
            </div>
          </div>
        )}

        <Group title="Business details" hint="The same on every call. Saved with the agent." empty="No business details yet.">
          {business.filter(match).map((v) => (
            <VarField
              key={v.name}
              v={v}
              value={config.variableValues[v.name] ?? ""}
              onChange={(value) => update({ variableValues: { ...config.variableValues, [v.name]: value } })}
              used={used.has(v.name)}
              other="Make per-call"
              onOther={() => setScope(v.name, "call")}
              onRemove={() => remove(v.name)}
            />
          ))}
        </Group>

        <Group title="Per-call values" hint="Different on every call (from your lead list or the incoming call). What you type here is only used when you test." empty="No per-call values.">
          {perCall.filter(match).map((v) => (
            <VarField
              key={v.name}
              v={v}
              value={testValues[v.name] ?? v.example ?? v.defaultValue ?? ""}
              onChange={(value) => onTestValues({ ...testValues, [v.name]: value })}
              used={used.has(v.name)}
              other="Make a business detail"
              onOther={() => setScope(v.name, "agent")}
              onRemove={() => remove(v.name)}
              testOnly
            />
          ))}
        </Group>

        <AddVariable existing={declared} onAdd={(v) => update({ variables: [...config.variables, v] })} />

        <div className="space-y-2">
          <div>
            <h3 className="text-sm font-medium">Filled in automatically</h3>
            <p className="text-xs text-muted-foreground">From the person being called and the time of the call. Use them anywhere; nothing to type.</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {auto.filter(match).map((v) => (
              <code key={v.name} title={v.label} className={cn("rounded-md border px-2 py-0.5 font-mono text-xs", used.has(v.name) ? "border-primary/40 bg-primary/5 text-primary" : "text-muted-foreground")}>
                {`{{${v.name}}}`}
              </code>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Chip({ children, tone }: { children: React.ReactNode; tone?: "warn" | "bad" }) {
  return (
    <span className={cn("rounded-full border px-2 py-0.5", tone === "warn" && "border-warning/50 bg-warning/10", tone === "bad" && "border-destructive/40 bg-destructive/5 text-destructive", !tone && "text-muted-foreground")}>
      {children}
    </span>
  );
}

function Group({ title, hint, empty, children }: { title: string; hint: string; empty: string; children: React.ReactNode[] }) {
  return (
    <div className="space-y-2">
      <div>
        <h3 className="text-sm font-medium">{title}</h3>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      {children.length ? <div className="grid gap-x-3 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3">{children}</div> : <p className="text-sm text-muted-foreground">{empty}</p>}
    </div>
  );
}

function VarField({ v, value, onChange, used, other, onOther, onRemove, testOnly }: {
  v: VariableDef;
  value: string;
  onChange: (value: string) => void;
  used: boolean;
  other: string;
  onOther: () => void;
  onRemove: () => void;
  testOnly?: boolean;
}) {
  const missing = v.required && !v.allowEmpty && !value.trim();
  return (
    <div className="group min-w-0 space-y-1">
      <div className="flex items-center justify-between gap-1.5">
        <label htmlFor={`v-${v.name}`} className="truncate text-[13px] font-medium" title={`{{${v.name}}}`}>
          {v.label}{v.required && <span className="text-destructive"> *</span>}
        </label>
        <span className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          <button type="button" onClick={onOther} title={other} aria-label={`${other}: ${v.name}`} className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"><ArrowLeftRight className="size-3.5" /></button>
          {!used && <button type="button" onClick={onRemove} title="Remove" aria-label={`Remove ${v.name}`} className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-destructive"><X className="size-3.5" /></button>}
        </span>
      </div>
      <Input id={`v-${v.name}`} value={value} aria-invalid={missing} placeholder={v.example ? `e.g. ${v.example}` : testOnly ? "Value for testing" : `{{${v.name}}}`} onChange={(e) => onChange(e.target.value)} className="h-8 text-sm" />
      <p className={cn("truncate font-mono text-[10.5px]", used ? "text-muted-foreground" : "text-warning")}>{`{{${v.name}}}`}{!used && <span className="font-sans"> · not in prompt</span>}</p>
    </div>
  );
}

function AddVariable({ existing, onAdd }: { existing: Set<string>; onAdd: (v: VariableDef) => void }) {
  const [name, setName] = useState("");
  const [scope, setScope] = useState<"agent" | "call">("call");
  const problem = !name ? null : !nameRe.test(name) ? "Use lowercase letters, numbers and underscores." : existing.has(name) ? "That variable already exists." : null;
  const add = () => {
    if (!name || problem) return;
    onAdd({ name, label: pretty(name), scope, required: false });
    setName("");
  };
  return (
    <div className="space-y-1.5 rounded-lg border border-dashed p-3">
      <p className="text-sm font-medium">Add a variable</p>
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-40 flex-1">
          <span className="absolute top-1/2 left-2.5 -translate-y-1/2 font-mono text-xs text-muted-foreground">{"{{"}</span>
          <Input value={name} onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())} placeholder="loan_amount" className="h-8 pl-7 font-mono text-sm" aria-label="New variable name" />
        </div>
        <Select value={scope} onChange={(e) => setScope(e.target.value as "agent" | "call")} className="h-8 w-auto text-sm" aria-label="Kind of variable">
          <option value="call">Per-call value</option>
          <option value="agent">Business detail</option>
        </Select>
        <Button size="sm" onClick={add} disabled={!name || Boolean(problem)}><Plus /> Add</Button>
      </div>
      {problem && <p className="text-xs text-destructive">{problem}</p>}
    </div>
  );
}
