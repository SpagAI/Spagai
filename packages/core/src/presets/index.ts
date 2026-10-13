/**
 * Preset agents, stored as JSON data files in packages/core/presets/.
 * To add a preset: drop a new JSON file there and add it to the list below.
 */

import { presetSchema, type AgentPreset } from "../agent";
import type { PromptTemplate } from "../prompt/types";

import clinicBooking from "../../presets/clinic-booking.json";
import deliveryConfirmation from "../../presets/delivery-confirmation.json";
import fintechOutboundZara from "../../presets/fintech-outbound-zara.json";
import fintechSupport from "../../presets/fintech-support.json";
import kycFollowUp from "../../presets/kyc-follow-up.json";
import realEstateLeadQualifier from "../../presets/real-estate-lead-qualifier.json";
import repaymentReminders from "../../presets/repayment-reminders.json";
import telecomChurnComplaint from "../../presets/telecom-churn-complaint.json";

const RAW: unknown[] = [
  fintechOutboundZara,
  fintechSupport,
  repaymentReminders,
  kycFollowUp,
  telecomChurnComplaint,
  realEstateLeadQualifier,
  clinicBooking,
  deliveryConfirmation,
];

/** All presets, validated. Throws at load time if a data file is malformed. */
export const PRESETS: AgentPreset[] = RAW.map((raw) => presetSchema.parse(raw));

export function getPreset(id: string): AgentPreset | undefined {
  return PRESETS.find((p) => p.id === id);
}

/** The prompt-compiler view of a preset. */
export function presetToTemplate(preset: AgentPreset): PromptTemplate {
  return { blocks: preset.blocks, variables: preset.variables, firstMessage: preset.firstMessage };
}
