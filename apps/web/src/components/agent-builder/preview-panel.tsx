"use client";

import {
  compilePrompt,
  findVariables,
  lintPrompt,
  sanitiseForSpeech,
  SYSTEM_VARIABLES,
  type AgentConfig,
  type LintIssue,
  type VariableDef,
} from "@spagai/core";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useT } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { sampleValues } from "./shared";

type View = "prompt" | "issues" | "variables";

const WARN_TOKENS = 1500;
const ERROR_TOKENS = 3000;

export function PreviewPanel({
  config,
  onAddVariable,
  readOnly,
}: {
  config: AgentConfig;
  onAddVariable: (v: VariableDef) => void;
  readOnly: boolean;
}) {
  const t = useT();
  const deferred = useDeferredValue(config);
  const [useSample, setUseSample] = useState(true);
  const [view, setView] = useState<View>("prompt");

  const { compiled, lint } = useMemo(() => {
    const values = useSample ? sampleValues(deferred) : deferred.variableValues;
    const compiled = compilePrompt(
      { blocks: deferred.blocks, variables: deferred.variables, firstMessage: deferred.firstMessage },
      { values, mode: "preview" },
    );
    const lint = lintPrompt({ prompt: compiled.prompt, firstMessage: compiled.firstMessage }, { warnTokens: WARN_TOKENS, errorTokens: ERROR_TOKENS });
    return { compiled, lint };
  }, [deferred, useSample]);

  const issueLines = new Set(lint.issues.map((i) => i.line).filter((l): l is number => l !== undefined));
  const lines = compiled.prompt.split("\n");

  const goToLine = (line: number) => {
    setView("prompt");
    requestAnimationFrame(() => document.getElementById(`prompt-line-${line}`)?.scrollIntoView({ block: "center", behavior: "smooth" }));
  };

  const scoreColour = lint.score >= 90 ? "bg-primary" : lint.score >= 60 ? "bg-warning" : "bg-destructive";
  const tokenPct = Math.min(100, (compiled.estimatedTokens / ERROR_TOKENS) * 100);
  const tokenColour = compiled.estimatedTokens > ERROR_TOKENS ? "bg-destructive" : compiled.estimatedTokens > WARN_TOKENS ? "bg-warning" : "bg-primary";
  const latencyKey = compiled.estimatedTokens > ERROR_TOKENS ? "latencyBad" : compiled.estimatedTokens > WARN_TOKENS ? "latencyWarn" : "latencyOk";

  return (
    <Card className="gap-3 xl:sticky xl:top-6 xl:max-h-[calc(100dvh-3rem)]">
      <CardHeader className="gap-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle>{t("builder.preview.title")}</CardTitle>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Switch checked={useSample} onCheckedChange={setUseSample} aria-label={t("builder.preview.sampleLead")} />
            {useSample ? t("builder.preview.sampleLead") : t("builder.preview.placeholders")}
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <Meter label={t("builder.preview.score")} value={`${lint.score}/100`} pct={lint.score} colour={scoreColour} />
          <Meter label={t("builder.preview.tokens")} value={`~${compiled.estimatedTokens}`} pct={tokenPct} colour={tokenColour} />
        </div>
        <p className="text-xs text-muted-foreground">{t(`builder.preview.${latencyKey}`)}</p>

        {compiled.errors.length > 0 && (
          <Alert variant="warning">
            <TriangleAlert />
            <p className="font-medium">{t("builder.preview.compileErrors")}</p>
            <ul className="mt-1 list-disc pl-6">
              {compiled.errors.map((e) => <li key={e}>{e}</li>)}
            </ul>
          </Alert>
        )}

        <div role="tablist" className="grid grid-cols-3 rounded-md bg-muted p-1 text-sm">
          {(["prompt", "issues", "variables"] as View[]).map((v) => (
            <button
              key={v}
              role="tab"
              type="button"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={cn("rounded px-2 py-1 transition-colors", view === v ? "bg-background font-medium shadow-xs" : "text-muted-foreground")}
            >
              {t(`builder.preview.${v}`)}
              {v === "issues" && lint.issues.length > 0 && ` (${lint.issues.length})`}
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="min-h-0 overflow-y-auto">
        {view === "prompt" && (
          <div className="space-y-3">
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <p className="text-xs font-medium text-muted-foreground">{t("builder.firstMessage.spokenAs")}</p>
              <p>{sanitiseForSpeech(compiled.firstMessage)}</p>
            </div>
            <pre className="overflow-x-auto rounded-md border bg-muted/40 py-2 font-mono text-xs leading-relaxed">
              {lines.map((line, i) => (
                <div
                  key={i}
                  id={`prompt-line-${i + 1}`}
                  className={cn("flex gap-3 px-2", issueLines.has(i + 1) && "bg-warning/20")}
                >
                  <span className="w-6 shrink-0 text-right text-muted-foreground select-none">{i + 1}</span>
                  <span className="whitespace-pre-wrap break-words">{line || " "}</span>
                </div>
              ))}
            </pre>
          </div>
        )}

        {view === "issues" && <IssueList issues={lint.issues} onGoToLine={goToLine} />}

        {view === "variables" && (
          <VariablesView config={deferred} report={compiled.variables} onAddVariable={onAddVariable} readOnly={readOnly} />
        )}
      </CardContent>
    </Card>
  );
}

function Meter({ label, value, pct, colour }: { label: string; value: string; pct: number; colour: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted">
        <div className={cn("h-1.5 rounded-full transition-all", colour)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

const SEVERITY_ICON = { error: CircleAlert, warning: TriangleAlert, info: Info } as const;
const SEVERITY_COLOUR = { error: "text-destructive", warning: "text-warning", info: "text-muted-foreground" } as const;

function IssueList({ issues, onGoToLine }: { issues: LintIssue[]; onGoToLine: (line: number) => void }) {
  const t = useT();
  if (issues.length === 0) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <CircleCheck className="size-4 text-primary" /> {t("builder.preview.noIssues")}
      </p>
    );
  }
  const order = { error: 0, warning: 1, info: 2 };
  return (
    <ul className="space-y-2">
      {[...issues].sort((a, b) => order[a.severity] - order[b.severity]).map((issue, i) => {
        const Icon = SEVERITY_ICON[issue.severity];
        return (
          <li key={i} className="rounded-md border p-2.5 text-sm">
            <div className="flex gap-2">
              <Icon className={cn("mt-0.5 size-4 shrink-0", SEVERITY_COLOUR[issue.severity])} />
              <div className="min-w-0 space-y-1">
                <p>{issue.message}</p>
                {issue.excerpt && <p className="truncate text-xs text-muted-foreground">“{issue.excerpt}”</p>}
                {issue.suggestion && <p className="text-xs text-muted-foreground">→ {issue.suggestion}</p>}
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-[10px]">{issue.rule}</Badge>
                  {issue.line !== undefined && (
                    <button type="button" className="text-xs text-primary underline-offset-2 hover:underline" onClick={() => onGoToLine(issue.line!)}>
                      {t("builder.preview.line")} {issue.line}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function VariablesView({
  config,
  report,
  onAddVariable,
  readOnly,
}: {
  config: AgentConfig;
  report: { missingRequired: string[]; undeclared: string[] };
  onAddVariable: (v: VariableDef) => void;
  readOnly: boolean;
}) {
  const t = useT();
  const used = new Set(findVariables([...config.blocks.map((b) => b.content), config.firstMessage].join("\n")));
  const all: VariableDef[] = [...config.variables, ...SYSTEM_VARIABLES];
  const [draft, setDraft] = useState({ name: "", label: "", scope: "agent" as VariableDef["scope"], required: false });
  const nameOk = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(draft.name) && !all.some((v) => v.name === draft.name);

  return (
    <div className="space-y-4 text-sm">
      <p className="text-xs text-muted-foreground">{t("builder.variables.intro")}</p>

      {report.undeclared.length > 0 && (
        <Alert variant="warning">
          <TriangleAlert />
          <p>{t("builder.variables.undeclared")}:</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {report.undeclared.map((name) => (
              <Button
                key={name}
                type="button"
                size="sm"
                variant="outline"
                disabled={readOnly}
                onClick={() => onAddVariable({ name, label: name.replace(/_/g, " "), scope: "agent", required: false })}
              >
                + {name}
              </Button>
            ))}
          </div>
        </Alert>
      )}

      <ul className="divide-y rounded-md border">
        {all.map((v) => {
          const missing = report.missingRequired.includes(v.name);
          return (
            <li key={v.name} className="flex flex-wrap items-center gap-2 px-3 py-2">
              <code className="font-mono text-xs">{`{{${v.name}}}`}</code>
              <span className="text-xs text-muted-foreground">{v.label}</span>
              <span className="ml-auto flex gap-1">
                <Badge variant="secondary">{t(`builder.variables.scope.${v.scope}`)}</Badge>
                {missing ? (
                  <Badge variant="destructive">{t("builder.variables.missing")}</Badge>
                ) : (
                  <Badge variant="outline" className={used.has(v.name) ? "" : "text-muted-foreground"}>
                    {used.has(v.name) ? t("builder.variables.used") : t("builder.variables.unused")}
                  </Badge>
                )}
              </span>
            </li>
          );
        })}
      </ul>

      {!readOnly && (
        <form
          className="space-y-2 rounded-md border p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!nameOk || !draft.label.trim()) return;
            onAddVariable({ ...draft, label: draft.label.trim() });
            setDraft({ name: "", label: "", scope: "agent", required: false });
          }}
        >
          <p className="font-medium">{t("builder.variables.addTitle")}</p>
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder={t("builder.variables.name")} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value.trim() })} aria-invalid={draft.name !== "" && !nameOk} />
            <Input placeholder={t("builder.variables.label")} value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
            <Select value={draft.scope} onChange={(e) => setDraft({ ...draft, scope: e.target.value as VariableDef["scope"] })}>
              <option value="agent">{t("builder.variables.scope.agent")}</option>
              <option value="call">{t("builder.variables.scope.call")}</option>
            </Select>
            <label className="flex items-center gap-2 text-xs">
              <Switch checked={draft.required} onCheckedChange={(required) => setDraft({ ...draft, required })} />
              {t("builder.variables.required")}
            </label>
          </div>
          <Button type="submit" size="sm" disabled={!nameOk || !draft.label.trim()}>{t("builder.variables.add")}</Button>
        </form>
      )}
    </div>
  );
}
