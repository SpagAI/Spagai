/**
 * Locked guardrail blocks. The compiler ALWAYS includes these.
 * Users can reword them in the Agent Builder, but cannot delete them.
 * If a guardrail's text is left empty, the default wording below is used.
 *
 * DRAFT wording - needs legal review before production use.
 */

import type { GuardrailId, PromptBlock } from "./types";

export const GUARDRAIL_ORDER: GuardrailId[] = ["calling_hours", "opt_out", "ai_disclosure", "data_safety"];

export const DEFAULT_GUARDRAILS: Record<GuardrailId, PromptBlock> = {
  calling_hours: {
    id: "guardrail_calling_hours",
    section: "anything_else",
    part: "guardrail",
    guardrail: "calling_hours",
    title: "Calling hours",
    content:
      "Calls only happen between 8am and 9pm West Africa Time. If the person asks you to call back, offer a time inside those hours only. If they say it is a bad time, do not push. Thank them and offer a better time.",
  },
  opt_out: {
    id: "guardrail_opt_out",
    section: "anything_else",
    part: "guardrail",
    guardrail: "opt_out",
    title: "Opt-out",
    content:
      "If the person asks not to be called again, asks to be removed from the list, or says stop, respect it at once. Apologise for the disturbance, confirm they will not be called again, record the opt-out with the save_lead_data tool, thank them and end the call. Never argue or try to change their mind.",
  },
  ai_disclosure: {
    id: "guardrail_ai_disclosure",
    section: "anything_else",
    part: "guardrail",
    guardrail: "ai_disclosure",
    title: "AI disclosure",
    content:
      "You are an AI voice assistant speaking on behalf of {{company_name}}. Say so in your introduction. If anyone asks whether you are a real person or a robot, answer honestly that you are an AI assistant. Never claim to be human.",
  },
  data_safety: {
    id: "guardrail_data_safety",
    section: "anything_else",
    part: "guardrail",
    guardrail: "data_safety",
    title: "Data safety",
    content:
      "Never ask for, repeat or accept card numbers, PINs, passwords, one-time codes or BVN. If the person starts to share any of these, stop them politely and explain that {{company_name}} will never ask for them on a call.",
  },
};

/** Phrases the linter looks for to confirm each guardrail is present in a prompt. */
export const GUARDRAIL_PATTERNS: Record<GuardrailId, RegExp> = {
  calling_hours:
    /calling hours|call(?:s|ing)? (?:only )?(?:happen )?between|8\s?(?:am|a\.m\.|:00)\b[\s\S]{0,40}9\s?(?:pm|p\.m\.)|08:00[\s\S]{0,20}21:00/i,
  opt_out:
    /opt[\s-]?out|not to be called|do not call|don't call|stop calling|remove(?:d)? (?:them |you |their number |your number )?from (?:the|our) list|unsubscribe/i,
  ai_disclosure:
    /\b(?:an? )?AI (?:voice )?(?:assistant|agent)\b|artificial intelligence|virtual assistant|automated assistant/i,
  data_safety: /\b(?:PIN|BVN|OTP|one[\s-]time (?:code|password)|card number)s?\b/i,
};
