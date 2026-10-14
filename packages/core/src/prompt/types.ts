/**
 * Shared types for the prompt compiler and linter.
 *
 * The founder's five-part framework:
 *   1. Beginning      - who the agent is, how it opens the call
 *   2. Adjunct        - context: the business, the person, tone, how to address them
 *   3. Body           - three phases: understand the problem; solution and what makes
 *                       us different; reassurance or a polite exit
 *   4. Anything else  - booking, routing, tools, AI disclosure and data safety
 *   5. End            - before you go, goodbye, end the call
 */

export type SectionId = "beginning" | "adjunct" | "body" | "anything_else" | "end";

export type BodyPhase = "understand" | "solution" | "reassure";
export type AnythingElsePart =
  | "booking"
  | "routing"
  | "tools"
  | "guardrail"
  | "other";
export type EndPart = "before_you_go" | "goodbye" | "end_call";
export type BlockPart = BodyPhase | AnythingElsePart | EndPart | "main";

/** Guardrails are locked: users may edit the wording but cannot remove them. */
export type GuardrailId = "calling_hours" | "opt_out" | "ai_disclosure" | "data_safety";

export interface PromptBlock {
  id: string;
  section: SectionId;
  /** Phase within the Body, or sub-part within Anything else / End. Defaults to "main". */
  part?: BlockPart;
  title: string;
  content: string;
  /** Set on locked guardrail blocks. */
  guardrail?: GuardrailId;
  /** Disabled blocks are skipped (guardrails cannot be disabled). */
  enabled?: boolean;
}

export type VariableScope =
  /** Filled once when the agent is built, e.g. business_name. */
  | "agent"
  /** Filled per call from the lead record, e.g. lead_name. */
  | "call"
  /** Filled automatically by the platform at call time, e.g. greeting. */
  | "system";

export interface VariableDef {
  name: string;
  label: string;
  scope: VariableScope;
  required: boolean;
  defaultValue?: string;
  example?: string;
  description?: string;
  /** An empty value is a real answer (e.g. no Sir/Ma when gender is unknown), not a missing one. */
  allowEmpty?: boolean;
}

export interface PromptTemplate {
  blocks: PromptBlock[];
  variables: VariableDef[];
  firstMessage?: string;
}
