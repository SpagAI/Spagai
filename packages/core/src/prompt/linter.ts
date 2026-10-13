/**
 * Prompt linter. Flags problems found in real test calls before they reach a customer.
 *
 * Rules:
 *  one-question-per-turn  A scripted line asks more than one question.
 *  spoken-symbols         A scripted line has symbols a voice would read aloud ("slash").
 *  sir-ma-placement       Sir/Ma in the same sentence as a title or name.
 *  missing-opt-out        No instruction for handling "please stop calling me".
 *  missing-ai-disclosure  The agent is not told to say it is an AI.
 *  missing-calling-hours  No calling-hours guard.
 *  missing-data-safety    No instruction to refuse PINs, OTPs, BVN, card numbers.
 *  prompt-too-long        Long prompts make the voice slower to answer.
 *  repeated-line          The same line appears more than once.
 *  after-hours-wording    Say "outside business hours", not "after hours".
 */

import { checkAddressRule } from "../address";
import { estimateTokens } from "./compiler";
import { GUARDRAIL_PATTERNS } from "./guardrails";

export type LintSeverity = "error" | "warning" | "info";

export type LintRuleId =
  | "one-question-per-turn"
  | "spoken-symbols"
  | "sir-ma-placement"
  | "missing-opt-out"
  | "missing-ai-disclosure"
  | "missing-calling-hours"
  | "missing-data-safety"
  | "prompt-too-long"
  | "repeated-line"
  | "after-hours-wording";

export interface LintIssue {
  rule: LintRuleId;
  severity: LintSeverity;
  message: string;
  /** 1-based line number in the prompt, when known. */
  line?: number;
  /** The offending text. */
  excerpt?: string;
  suggestion?: string;
}

export interface LintOptions {
  /** Warn above this many estimated tokens. Default 1500. */
  warnTokens?: number;
  /** Error above this many estimated tokens. Default 3000. */
  errorTokens?: number;
}

export interface LintInput {
  prompt: string;
  firstMessage?: string;
  /** Extra lines the agent will say word for word. */
  scriptedLines?: string[];
}

export interface LintReport {
  issues: LintIssue[];
  counts: Record<LintSeverity, number>;
  /** 0-100. 100 = no issues. */
  score: number;
}

const SYMBOL_RE = /[/\\*#_~|<>[\]&@%^=+]|\{(?!\{)|(?<!\})\}|[\p{Extended_Pictographic}]/gu;
const PLACEHOLDER_RE = /\{\{\s*[a-zA-Z_][a-zA-Z0-9_]*\s*\}\}/g;

export interface ScriptedLine {
  text: string;
  line?: number;
}

/**
 * Lines the agent will say word for word: text inside double quotes,
 * and lines that start with "Say:".
 */
export function extractScriptedLines(prompt: string): ScriptedLine[] {
  const out: ScriptedLine[] = [];
  prompt.split("\n").forEach((rawLine, i) => {
    const line = i + 1;
    for (const m of rawLine.matchAll(/["“]([^"”]{6,})["”]/g)) {
      if (/\p{L}/u.test(m[1]!)) out.push({ text: m[1]!.trim(), line });
    }
    const say = /^\s*(?:[-*]\s*)?say:\s*(.+)$/i.exec(rawLine);
    if (say && !/["“]/.test(say[1]!)) out.push({ text: say[1]!.trim(), line });
  });
  return out;
}

/** Rules that apply to a single line the agent speaks. Used by the simulator too. */
export function lintSpokenLine(text: string, line?: number): LintIssue[] {
  const issues: LintIssue[] = [];
  const at = line === undefined ? {} : { line };

  const questions = (text.match(/\?/g) ?? []).length;
  if (questions > 1) {
    issues.push({
      rule: "one-question-per-turn",
      severity: "warning",
      message: `This line asks ${questions} questions. Ask one question per turn and wait for the answer.`,
      excerpt: text,
      suggestion: "Split it into separate turns.",
      ...at,
    });
  }

  const withoutPlaceholders = text.replace(PLACEHOLDER_RE, "");
  const symbols = [...new Set(withoutPlaceholders.match(SYMBOL_RE) ?? [])];
  if (symbols.length) {
    issues.push({
      rule: "spoken-symbols",
      severity: "warning",
      message: `The voice may read these symbols aloud: ${symbols.join(" ")}`,
      excerpt: text,
      suggestion: "Write it the way you would say it (e.g. \"and\" instead of \"&\", \"or\" instead of \"/\").",
      ...at,
    });
  }

  for (const v of checkAddressRule(text)) {
    issues.push({
      rule: "sir-ma-placement",
      severity: "warning",
      message: v.reason,
      excerpt: v.sentence,
      suggestion: "Use the name or title in one sentence and Sir/Ma in a different sentence.",
      ...at,
    });
  }

  if (/\bafter[\s-]hours\b/i.test(text)) issues.push(afterHoursIssue(text, line));
  return issues;
}

function afterHoursIssue(text: string, line?: number): LintIssue {
  return {
    rule: "after-hours-wording",
    severity: "info",
    message: "Prefer \"outside business hours\" to \"after hours\".",
    excerpt: text.trim(),
    suggestion: "outside business hours",
    ...(line === undefined ? {} : { line }),
  };
}

export function lintPrompt(input: LintInput, options: LintOptions = {}): LintReport {
  const warnTokens = options.warnTokens ?? 1500;
  const errorTokens = options.errorTokens ?? 3000;
  const { prompt } = input;
  const issues: LintIssue[] = [];

  // Scripted lines
  const scripted: ScriptedLine[] = [
    ...(input.firstMessage ? [{ text: input.firstMessage }] : []),
    ...extractScriptedLines(prompt),
    ...(input.scriptedLines ?? []).map((text) => ({ text })),
  ];
  for (const s of scripted) {
    issues.push(...lintSpokenLine(s.text, s.line).filter((i) => i.rule !== "after-hours-wording"));
  }

  // "after hours" anywhere in the prompt
  prompt.split("\n").forEach((l, i) => {
    if (/\bafter[\s-]hours\b/i.test(l)) issues.push(afterHoursIssue(l, i + 1));
  });

  // Required guardrails
  const missing: Array<[keyof typeof GUARDRAIL_PATTERNS, LintRuleId, string]> = [
    ["opt_out", "missing-opt-out", "No opt-out instruction. The agent must stop and record it when someone asks not to be called."],
    ["ai_disclosure", "missing-ai-disclosure", "The agent is not told to say it is an AI assistant."],
    ["calling_hours", "missing-calling-hours", "No calling-hours guard (8am to 9pm WAT)."],
    ["data_safety", "missing-data-safety", "No instruction to refuse PINs, OTPs, BVN or card numbers."],
  ];
  for (const [id, rule, message] of missing) {
    if (!GUARDRAIL_PATTERNS[id].test(prompt)) issues.push({ rule, severity: "error", message });
  }

  // Length
  const tokens = estimateTokens(prompt);
  if (tokens > errorTokens) {
    issues.push({
      rule: "prompt-too-long",
      severity: "error",
      message: `Prompt is about ${tokens} tokens. Above ${errorTokens} the voice will be noticeably slow to reply.`,
      suggestion: "Cut repeated instructions and long examples.",
    });
  } else if (tokens > warnTokens) {
    issues.push({
      rule: "prompt-too-long",
      severity: "warning",
      message: `Prompt is about ${tokens} tokens. Above ${warnTokens} replies may start to feel slow.`,
      suggestion: "Trim where you can.",
    });
  }

  // Repeated lines
  const seen = new Map<string, number>();
  prompt.split("\n").forEach((l, i) => {
    const key = l.trim().toLowerCase().replace(/\s+/g, " ");
    if (key.length < 20 || key.startsWith("#")) return;
    const first = seen.get(key);
    if (first !== undefined) {
      issues.push({
        rule: "repeated-line",
        severity: "warning",
        message: `This line repeats line ${first}.`,
        line: i + 1,
        excerpt: l.trim(),
        suggestion: "Remove the duplicate.",
      });
    } else {
      seen.set(key, i + 1);
    }
  });

  return summarise(issues);
}

const PENALTY: Record<LintSeverity, number> = { error: 25, warning: 10, info: 2 };

export function summarise(issues: LintIssue[]): LintReport {
  const counts: Record<LintSeverity, number> = { error: 0, warning: 0, info: 0 };
  for (const i of issues) counts[i.severity]++;
  const score = Math.max(0, 100 - issues.reduce((sum, i) => sum + PENALTY[i.severity], 0));
  return { issues, counts, score };
}
