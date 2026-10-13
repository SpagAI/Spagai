/**
 * Prompt compiler: turns blocks + variable values into one system prompt,
 * always in the five-part framework order, always with the locked guardrails.
 */

import { DEFAULT_GUARDRAILS, GUARDRAIL_ORDER } from "./guardrails";
import type { BlockPart, GuardrailId, PromptBlock, PromptTemplate, SectionId, VariableDef } from "./types";
import { SYSTEM_VARIABLES, findVariables, renderVariables } from "./variables";

export const SECTION_ORDER: SectionId[] = ["beginning", "adjunct", "body", "anything_else", "end"];

export const SECTION_TITLES: Record<SectionId, string> = {
  beginning: "1. Beginning",
  adjunct: "2. Adjunct (context)",
  body: "3. Body",
  anything_else: "4. Anything else",
  end: "5. End",
};

/** Order of parts inside each section. Parts not listed come last. */
const PART_ORDER: BlockPart[] = [
  "main",
  "understand", "solution", "reassure",
  "booking", "routing", "tools", "other", "guardrail",
  "before_you_go", "goodbye", "end_call",
];

export const PART_TITLES: Partial<Record<BlockPart, string>> = {
  understand: "Phase 1: Understand the problem",
  solution: "Phase 2: Solution and what makes us different",
  reassure: "Phase 3: Reassurance or polite exit",
  booking: "Booking",
  routing: "Routing",
  tools: "Tools",
  guardrail: "Guardrails (always on)",
  before_you_go: "Before you go",
  goodbye: "Goodbye",
  end_call: "End the call",
};

/** Rough token estimate: about 4 characters per token for English. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export interface CompileOptions {
  /** Values for agent, call and system variables. */
  values?: Record<string, string | undefined>;
  /**
   * "preview": call and system variables may stay as {{placeholders}}.
   * "call":    every required variable must have a value (used when dialling).
   */
  mode?: "preview" | "call";
}

export interface CompiledSection {
  section: SectionId;
  title: string;
  text: string;
}

export interface VariableReport {
  /** Required variables with no value (for the current mode). */
  missingRequired: string[];
  /** Used in text but not declared anywhere. */
  undeclared: string[];
  /** Declared but never used. */
  unused: string[];
  /** Still shown as {{placeholders}} in the output. */
  unresolved: string[];
}

export interface CompileResult {
  prompt: string;
  firstMessage: string;
  sections: CompiledSection[];
  /** Guardrails that were missing (or empty) and were added from defaults. */
  guardrailsInjected: GuardrailId[];
  variables: VariableReport;
  characters: number;
  words: number;
  estimatedTokens: number;
  /** Blocking problems. Empty means OK to use. */
  errors: string[];
}

/** Ensure every locked guardrail is present, filling empty ones with default wording. */
export function withGuardrails(blocks: PromptBlock[]): { blocks: PromptBlock[]; injected: GuardrailId[] } {
  const injected: GuardrailId[] = [];
  const result = blocks.map((b) => {
    if (b.guardrail && !b.content.trim()) {
      injected.push(b.guardrail);
      return { ...DEFAULT_GUARDRAILS[b.guardrail], ...b, content: DEFAULT_GUARDRAILS[b.guardrail].content, enabled: true };
    }
    return b.guardrail ? { ...b, enabled: true } : b;
  });
  for (const id of GUARDRAIL_ORDER) {
    if (!result.some((b) => b.guardrail === id)) {
      injected.push(id);
      result.push({ ...DEFAULT_GUARDRAILS[id] });
    }
  }
  return { blocks: result, injected };
}

function partRank(part: BlockPart | undefined): number {
  const i = PART_ORDER.indexOf(part ?? "main");
  return i === -1 ? PART_ORDER.length : i;
}

export function compilePrompt(template: PromptTemplate, options: CompileOptions = {}): CompileResult {
  const mode = options.mode ?? "preview";
  const values = options.values ?? {};
  const errors: string[] = [];

  const { blocks, injected } = withGuardrails(template.blocks);
  const active = blocks.filter((b) => b.enabled !== false && b.content.trim());

  // Variable defaults
  const declared: VariableDef[] = [...template.variables, ...SYSTEM_VARIABLES];
  const declaredNames = new Set(declared.map((v) => v.name));
  const filled: Record<string, string | undefined> = {};
  for (const v of declared) if (v.defaultValue) filled[v.name] = v.defaultValue;
  Object.assign(filled, Object.fromEntries(Object.entries(values).filter(([, v]) => v !== undefined && v !== "")));

  // Build sections in framework order
  const sections: CompiledSection[] = [];
  for (const section of SECTION_ORDER) {
    const inSection = active
      .map((b, index) => ({ b, index }))
      .filter(({ b }) => b.section === section)
      .sort((x, y) => partRank(x.b.part) - partRank(y.b.part) || x.index - y.index)
      .map(({ b }) => b);
    if (inSection.length === 0) continue;

    const lines: string[] = [`## ${SECTION_TITLES[section]}`];
    let lastPart: BlockPart | undefined;
    for (const block of inSection) {
      const part = block.part ?? "main";
      if (part !== lastPart && PART_TITLES[part]) lines.push("", `### ${PART_TITLES[part]}`);
      lastPart = part;
      const sameAsPart = PART_TITLES[part]?.toLowerCase().endsWith(block.title.toLowerCase());
      lines.push("", ...(sameAsPart ? [] : [`**${block.title}**`]), block.content.trim());
    }
    sections.push({ section, title: SECTION_TITLES[section], text: renderVariables(lines.join("\n"), filled) });
  }

  const rawText = active.map((b) => b.content).join("\n") + "\n" + (template.firstMessage ?? "");
  const used = findVariables(rawText);

  const prompt = sections.map((s) => s.text).join("\n\n");
  const firstMessage = renderVariables(template.firstMessage ?? "", filled);
  const unresolved = findVariables(prompt + "\n" + firstMessage);

  const missingRequired = declared
    .filter((v) => used.includes(v.name) && !filled[v.name])
    .filter((v) => (mode === "call" ? v.required || v.scope === "system" : v.required && v.scope === "agent"))
    .map((v) => v.name);

  const variables: VariableReport = {
    missingRequired,
    undeclared: used.filter((n) => !declaredNames.has(n)),
    unused: template.variables.filter((v) => !used.includes(v.name)).map((v) => v.name),
    unresolved,
  };

  if (missingRequired.length) errors.push(`Missing required values: ${missingRequired.join(", ")}.`);
  if (variables.undeclared.length) errors.push(`Unknown variables: ${variables.undeclared.join(", ")}.`);
  if (mode === "call" && unresolved.length) errors.push(`Unfilled placeholders: ${unresolved.join(", ")}.`);
  if (!firstMessage.trim()) errors.push("First message is empty.");

  return {
    prompt,
    firstMessage,
    sections,
    guardrailsInjected: injected,
    variables,
    characters: prompt.length,
    words: prompt.split(/\s+/).filter(Boolean).length,
    estimatedTokens: estimateTokens(prompt),
    errors,
  };
}
