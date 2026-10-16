/**
 * Zara, the in-app assistant on Home, turns a plain description ("an agent that reminds my
 * customers about loan repayments") into an agent plan. This demo version is rule-based, so it
 * works without an AI service: it spots the kind of agent, the business name, the agent's name,
 * inbound or outbound, the voice and language, and fills in a ready-made template.
 */
import { VOICE_CATALOGUE } from "@spagai/core";

export type ZaraMode = "plan" | "build";
type Direction = "inbound" | "outbound";
type Gender = "female" | "male";

export interface AgentPlan {
  agentName: string;
  company: string;
  direction: Direction;
  /** Template used as the starting point, or null for a custom agent */
  presetId: string | null;
  useCase: string;
  purpose: string;
  language: string;
  voiceId: string;
  voiceName: string;
  voiceGender: Gender;
  firstMessage: string;
  abilities: string[];
  /** Business details still to fill in after building */
  toFill: string[];
}

interface UseCase {
  id: string;
  presetId: string | null;
  label: string;
  match: RegExp;
  direction: Direction;
  name: string;
  gender: Gender;
  purpose: string;
  abilities: string[];
  toFill: string[];
}

const USE_CASES: UseCase[] = [
  {
    id: "clinic", presetId: "clinic-booking", label: "Clinic receptionist",
    match: /clinic|hospital|doctor|patient|dental|dentist|pharmac|health|medical|appointment/i,
    direction: "inbound", name: "Halima", gender: "female",
    purpose: "Answers calls from patients, books, moves and confirms appointments, and points emergencies to the right line.",
    abilities: ["Check free appointment times", "Book and reschedule appointments", "Save the caller's details", "End the call politely"],
    toFill: ["Clinic address", "Emergency phone line"],
  },
  {
    id: "realestate", presetId: "real-estate-lead-qualifier", label: "Property lead qualifier",
    match: /real ?estate|propert|apartment|flat|duplex|house|land|plot|estate|rent|viewing|inspection|lekki|ikoyi/i,
    direction: "outbound", name: "Bisi", gender: "female",
    purpose: "Calls people who asked about a property, checks their budget and timing, and books a viewing with your team.",
    abilities: ["Ask about budget and move-in date", "Book an inspection or viewing", "Save the lead's answers", "End the call politely"],
    toFill: ["Property name", "Price range"],
  },
  {
    id: "repayment", presetId: "repayment-reminders", label: "Repayment reminders",
    match: /repay|loan|overdue|debt|owing|due date|payment reminder|remind.*pay|instal/i,
    direction: "outbound", name: "Amaka", gender: "female",
    purpose: "Politely reminds customers about upcoming or overdue repayments and records when they promise to pay. No threats, no shaming.",
    abilities: ["Remind about the amount and due date", "Record a promise to pay", "Save the customer's answers", "End the call politely"],
    toFill: ["How customers can pay (e.g. bank transfer details)"],
  },
  {
    id: "delivery", presetId: "delivery-confirmation", label: "Delivery confirmation",
    match: /deliver|dispatch|courier|logistic|package|parcel|shipment|rider/i,
    direction: "outbound", name: "Musa", gender: "male",
    purpose: "Confirms the delivery address and a time window before dispatch, and reschedules when the customer is not available.",
    abilities: ["Confirm address and time window", "Reschedule a delivery", "Save the customer's answers", "End the call politely"],
    toFill: [],
  },
  {
    id: "kyc", presetId: "kyc-follow-up", label: "KYC follow-up",
    match: /\bkyc\b|verif|\bbvn\b|\bnin\b|onboard|sign.?up|registration|complete.*(profile|account)/i,
    direction: "outbound", name: "Kemi", gender: "female",
    purpose: "Calls new customers who have not finished verifying their account and walks them through the next step.",
    abilities: ["Explain what is missing", "Guide them through the next step", "Save the customer's answers", "End the call politely"],
    toFill: ["Your app's name", "Why verifying helps the customer"],
  },
  {
    id: "churn", presetId: "telecom-churn-complaint", label: "Customer win-back",
    match: /churn|telecom|airtime|data plan|subscriber|cancel|unsubscri|leaving|win.?back|retention/i,
    direction: "outbound", name: "Ifeanyi", gender: "male",
    purpose: "Calls customers who complained or are about to leave, listens, logs the issue and offers something to keep them.",
    abilities: ["Listen and log the complaint", "Offer a retention deal", "Save the customer's answers", "End the call politely"],
    toFill: ["The offer you can make"],
  },
  {
    id: "support", presetId: "fintech-support", label: "Customer support line",
    match: /support|customer (service|care)|help ?desk|enquir|inquir|complain|question/i,
    direction: "inbound", name: "Tolu", gender: "female",
    purpose: "Answers customer calls, helps with common questions step by step, and logs anything it cannot solve for your team.",
    abilities: ["Answer common questions", "Log issues for your team", "Save the caller's details", "End the call politely"],
    toFill: ["Support hours", "Your app's name"],
  },
  {
    id: "sales", presetId: null, label: "Sales follow-up",
    match: /lead|sales|sell|offer|promo|follow.?up|prospect|webinar|event|invite/i,
    direction: "outbound", name: "Ada", gender: "female",
    purpose: "Calls new leads, explains your offer in simple words, answers questions and books a short meeting with your team.",
    abilities: ["Introduce your offer", "Answer common questions", "Book a meeting", "End the call politely"],
    toFill: [],
  },
];

const CUSTOM: UseCase = {
  id: "custom", presetId: null, label: "Custom agent", match: /$^/,
  direction: "outbound", name: "Ada", gender: "female",
  purpose: "", abilities: ["Have a natural conversation", "Save the caller's answers", "End the call politely"], toFill: [],
};

const LANGUAGES: [RegExp, string][] = [[/pidgin/i, "pcm"], [/yoruba/i, "yo"], [/hausa/i, "ha"], [/igbo/i, "ig"], [/english/i, "en-NG"]];
const LANGUAGE_NAMES: Record<string, string> = { "en-NG": "English", pcm: "Pidgin", yo: "Yoruba", ha: "Hausa", ig: "Igbo" };

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function pickVoice(language: string, gender: Gender) {
  const own = VOICE_CATALOGUE.filter((v) => v.provider === "spagai" && v.status === "available");
  const v = own.find((x) => x.language === language && x.gender === gender)
    ?? own.find((x) => x.language === language)
    ?? own.find((x) => x.language === "en-NG" && x.gender === gender)
    ?? own[0]!;
  return { voiceId: v.id, voiceName: v.name, voiceGender: v.gender };
}

function firstMessageFor(direction: Direction) {
  return direction === "outbound"
    ? "Hello, this is {{agent_name}}, an AI assistant calling from {{company_name}}. Is this a good time to talk?"
    : "Hello, thank you for calling {{company_name}}. My name is {{agent_name}}, an AI assistant. How can I help you today?";
}

/** Words that are never a business or agent name. */
const NOT_NAMES = /^(it|him|her|my|our|the|a|an|me|us|them|this|that|customers?|clients?|people|leads?|patients?|you|your|agent|zara|inbound|outbound|male|female)$/i;

function findName(text: string): string | null {
  const m = /\b(?:call(?:ed)? (?:it|him|her|the agent)|name (?:it|him|her|the agent)|named|called|agent'?s? name is|his name (?:is|should be)|her name (?:is|should be))\s+([A-Za-z][a-z'-]{1,20})/i.exec(text);
  return m && !NOT_NAMES.test(m[1]!) ? cap(m[1]!) : null;
}

function findCompany(text: string): string | null {
  const m = /\b(?:for|at|from|company is|business is|company,|we are|i run|i own)\s+((?:[A-Z0-9][\w&'.-]*)(?:\s+(?:[A-Z0-9][\w&'.-]*|&|and|of))*)/.exec(text);
  if (!m) return null;
  const name = m[1]!.replace(/\s+(and|of|&)$/i, "").trim();
  return NOT_NAMES.test(name) || name.length < 2 ? null : name;
}

function findDirection(text: string): Direction | null {
  if (/\b(answer|answers|answering|receive|receives|incoming|inbound|pick(s)? up|receptionist|reception|when (people|customers|patients) call)\b/i.test(text)) return "inbound";
  if (/\b(call (my|our|the|new|all)|outbound|reach out|remind|follow.?up|calls? (customers|leads|people|clients|patients))\b/i.test(text)) return "outbound";
  return null;
}

function findGender(text: string): Gender | null {
  if (/\b(male|man|gentleman|guy|deep voice|his voice)\b/i.test(text)) return "male";
  if (/\b(female|woman|lady|her voice)\b/i.test(text)) return "female";
  // "call him Tunde" / "name her Ada" also tell us which voice to use.
  if (/\b(call(ed)?|name(d)?) him\b/i.test(text)) return "male";
  if (/\b(call(ed)?|name(d)?) her\b/i.test(text)) return "female";
  return null;
}

function findLanguage(text: string): string | null {
  return LANGUAGES.find(([re]) => re.test(text))?.[1] ?? null;
}

function useCaseFor(text: string): UseCase | null {
  return USE_CASES.find((u) => u.match.test(text)) ?? null;
}

/** Is this message describing something to build (rather than "hi" or "thanks")? */
export function soundsLikeARequest(text: string): boolean {
  return !!useCaseFor(text) || /\b(agent|build|create|make|bot|assistant|call|answer|remind|book)\b/i.test(text);
}

/** A first plan from a description. */
export function draftPlan(text: string, defaults: { company: string }): AgentPlan {
  const u = useCaseFor(text) ?? CUSTOM;
  const direction = findDirection(text) ?? u.direction;
  const language = findLanguage(text) ?? "en-NG";
  const voice = pickVoice(language, findGender(text) ?? u.gender);
  const agentName = findName(text) ?? u.name;
  return {
    agentName,
    company: findCompany(text) ?? defaults.company,
    direction,
    presetId: u.presetId,
    useCase: u.label,
    purpose: u.purpose || cap(text.trim().replace(/^(i want|i need|please|can you|build|create|make)( me)?( an?)?( agent)?( that| to| which)?\s*/i, "")).slice(0, 300),
    language,
    ...voice,
    firstMessage: firstMessageFor(direction),
    abilities: u.abilities,
    toFill: u.toFill,
  };
}

/** Apply a follow-up like "call her Ada", "make it inbound" or "use a male voice". */
export function refinePlan(plan: AgentPlan, text: string): { plan: AgentPlan; changes: string[] } {
  const changes: string[] = [];
  let next = { ...plan };
  const u = useCaseFor(text);
  if (u && u.label !== plan.useCase && /\b(instead|actually|change|switch|rather|no,? )/i.test(text)) {
    next = { ...draftPlan(text, { company: plan.company }), company: plan.company };
    changes.push(`switched to a ${u.label.toLowerCase()} agent`);
  }
  const name = findName(text);
  if (name && name !== next.agentName) { next.agentName = name; changes.push(`named the agent ${name}`); }
  const company = findCompany(text);
  if (company && company !== next.company && !name) { next.company = company; changes.push(`set the business to ${company}`); }
  const direction = findDirection(text);
  if (direction && direction !== next.direction) {
    next.direction = direction;
    next.firstMessage = firstMessageFor(direction);
    changes.push(direction === "inbound" ? "made it answer incoming calls" : "made it call people (outbound)");
  }
  const language = findLanguage(text);
  const gender = findGender(text);
  if ((language && language !== next.language) || (gender && gender !== next.voiceGender)) {
    next.language = language ?? next.language;
    Object.assign(next, pickVoice(next.language, gender ?? next.voiceGender));
    changes.push(`chose ${next.voiceName}, a ${next.voiceGender} ${LANGUAGE_NAMES[next.language] ?? ""} voice`.replace("  ", " "));
  }
  return { plan: next, changes };
}

/** "build it", "go ahead", "looks good"… */
export function wantsToBuild(text: string): boolean {
  return /\b(build( it| this| now)?|go ahead|looks good|perfect|yes|yep|ok(ay)?|do it|create it|proceed|approve|ship it)\b/i.test(text) && !/\b(don'?t|not yet|wait|no)\b/i.test(text);
}

export const languageName = (code: string) => LANGUAGE_NAMES[code] ?? code;

export const SUGGESTIONS = [
  "A receptionist that answers calls and books appointments for my clinic",
  "Call people who asked about our Lekki apartments and book viewings",
  "Remind customers about their loan repayments before the due date",
  "Confirm delivery addresses before our riders dispatch orders",
];
