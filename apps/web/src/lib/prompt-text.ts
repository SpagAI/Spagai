/**
 * One prompt box: the person's own instructions as one text, whatever template they came from.
 * The locked safety rules (guardrail blocks) are kept separately and never shown in the box.
 * Pure, so it can be tested.
 */
import type { AgentConfig } from "@spagai/core";

/** The id of the single block that holds the prompt text once it is edited. */
export const PROMPT_BLOCK_ID = "custom_instructions";

const own = (config: AgentConfig) => config.blocks.filter((b) => !b.guardrail && b.enabled !== false);

/** The prompt as one text. A template's parts are joined, each under its title. */
export function promptText(config: AgentConfig): string {
  const blocks = own(config);
  if (blocks.length === 1) return blocks[0]!.content;
  return blocks
    .filter((b) => b.content.trim())
    .map((b) => `### ${b.title}\n${b.content.trim()}`)
    .join("\n\n");
}

/** Save the box's text: it replaces the person's own parts with one block; safety rules stay. */
export function withPromptText(config: AgentConfig, text: string): AgentConfig {
  const guardrails = config.blocks.filter((b) => b.guardrail);
  const block = { id: PROMPT_BLOCK_ID, section: "beginning" as const, part: "main" as const, title: "Your instructions", content: text };
  return { ...config, blocks: [block, ...guardrails] };
}
