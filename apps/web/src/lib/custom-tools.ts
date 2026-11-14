/**
 * The workspace's own tools: actions an agent can take during a call by calling a webhook.
 * Pure (no network), so it can be tested. Sending happens in src/server/custom-tools.ts.
 */
import { z } from "zod";

export const PARAM_TYPES = {
  text: "Text",
  number: "Number",
  boolean: "Yes / no",
  date: "Date",
  time: "Time",
  email: "Email",
  phone: "Phone number",
  choice: "One of a list",
} as const;
export type ParamType = keyof typeof PARAM_TYPES;

/** Built-in tool names a custom tool may not take. */
export const RESERVED_NAMES = ["check_calendar", "book_appointment", "reschedule_appointment", "save_lead_data", "end_call"];

const nameRe = /^[a-z][a-z0-9_]{1,39}$/;

export const toolParamSchema = z.object({
  name: z.string().regex(nameRe, "Detail names use lowercase letters, numbers and underscores, e.g. full_name."),
  type: z.enum(Object.keys(PARAM_TYPES) as [ParamType, ...ParamType[]]),
  required: z.boolean(),
  description: z.string().trim().max(300),
  options: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
});
export type ToolParam = z.infer<typeof toolParamSchema>;

export const CONTEXT_KEYS = { agent: "Agent's name and id", call: "Call id", caller: "Caller's or lead's phone number", lead: "Lead's name", time: "Date and time (Lagos)" } as const;
export type ContextKey = keyof typeof CONTEXT_KEYS;

export const toolInputSchema = z.object({
  name: z.string().regex(nameRe, "Tool names use lowercase letters, numbers and underscores, e.g. create_crm_lead.").refine((n) => !RESERVED_NAMES.includes(n), "That name belongs to a built-in tool."),
  label: z.string().trim().min(1, "Give the tool a label.").max(60),
  description: z.string().trim().min(10, "Say when the agent should use this tool.").max(1000),
  parameters: z.array(toolParamSchema).max(20).refine((ps) => new Set(ps.map((p) => p.name)).size === ps.length, "Each detail needs a different name."),
  url: z.string().trim().max(2000),
  method: z.enum(["POST", "GET", "PUT", "PATCH"]),
  /** value "" with secret true on an existing tool means "keep the saved secret". */
  headers: z.array(z.object({ name: z.string().trim().regex(/^[A-Za-z0-9-]{1,60}$/, "Header names use letters, numbers and hyphens."), value: z.string().max(2000), secret: z.boolean() })).max(10),
  sendContext: z.object({ agent: z.boolean(), call: z.boolean(), caller: z.boolean(), lead: z.boolean(), time: z.boolean() }),
  timeoutMs: z.number().int().min(1000).max(20000),
  waitMessage: z.string().trim().max(200),
});
export type ToolInput = z.infer<typeof toolInputSchema>;

/**
 * Only public https addresses: no localhost, private networks or cloud metadata addresses.
 * Returns an error message, or null when the address is fine.
 */
export function webhookUrlProblem(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return "Enter a full web address, starting with https://";
  }
  if (url.protocol !== "https:") return "The web address must start with https://";
  if (url.username || url.password) return "Do not put a username or password in the web address; use a header instead.";
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || !host.includes(".") && !host.includes(":")) {
    return "That address is not reachable from the internet.";
  }
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224) {
      return "Private or internal addresses are not allowed.";
    }
  }
  if (host.includes(":") && (host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80") || host === "::")) {
    return "Private or internal addresses are not allowed.";
  }
  return null;
}

/** The details table as the JSON Schema the AI reads. */
export function toJsonSchema(params: ToolParam[]) {
  const properties: Record<string, Record<string, unknown>> = {};
  for (const p of params) {
    const base: Record<string, unknown> = { description: p.description || p.name.replace(/_/g, " ") };
    switch (p.type) {
      case "number": properties[p.name] = { ...base, type: "number" }; break;
      case "boolean": properties[p.name] = { ...base, type: "boolean" }; break;
      case "date": properties[p.name] = { ...base, type: "string", description: `${base.description} (YYYY-MM-DD)`, pattern: "^\\d{4}-\\d{2}-\\d{2}$" }; break;
      case "time": properties[p.name] = { ...base, type: "string", description: `${base.description} (24-hour HH:MM)`, pattern: "^\\d{2}:\\d{2}$" }; break;
      case "email": properties[p.name] = { ...base, type: "string", description: `${base.description} (an email address)` }; break;
      case "phone": properties[p.name] = { ...base, type: "string", description: `${base.description} (a phone number, digits only)` }; break;
      case "choice": properties[p.name] = { ...base, type: "string", enum: p.options?.length ? p.options : undefined }; break;
      default: properties[p.name] = { ...base, type: "string" };
    }
  }
  return { type: "object", properties, required: params.filter((p) => p.required).map((p) => p.name) };
}

/** Keep only the declared details; say which required ones are missing. */
export function cleanArguments(params: ToolParam[], args: Record<string, unknown>): { values: Record<string, string | number | boolean>; missing: string[] } {
  const values: Record<string, string | number | boolean> = {};
  for (const p of params) {
    const v = args[p.name];
    if (v === undefined || v === null || v === "") continue;
    if (p.type === "number") {
      const n = typeof v === "number" ? v : Number(String(v).replace(/[^\d.-]/g, ""));
      if (Number.isFinite(n)) values[p.name] = n;
    } else if (p.type === "boolean") {
      values[p.name] = v === true || /^(true|yes|y|1)$/i.test(String(v));
    } else {
      values[p.name] = String(v).slice(0, 1000);
    }
  }
  return { values, missing: params.filter((p) => p.required && values[p.name] === undefined).map((p) => p.name) };
}

export interface ToolContext {
  agent?: { id: string; name: string };
  callId?: string;
  callerPhone?: string;
  leadName?: string;
  now?: Date;
}

/** Exactly what is sent to the webhook (headers other than the signature are added by the server). */
export function buildRequest(tool: { name: string; url: string; method: string; sendContext: Record<ContextKey, boolean> }, args: Record<string, unknown>, context: ToolContext, test: boolean) {
  const ctx: Record<string, unknown> = {};
  if (tool.sendContext.agent && context.agent) ctx.agent = context.agent;
  if (tool.sendContext.call && context.callId) ctx.call_id = context.callId;
  if (tool.sendContext.caller && context.callerPhone) ctx.phone = context.callerPhone;
  if (tool.sendContext.lead && context.leadName) ctx.lead_name = context.leadName;
  if (tool.sendContext.time) ctx.time = (context.now ?? new Date()).toISOString();
  const payload = { tool: tool.name, arguments: args, context: ctx, test };
  if (tool.method === "GET") {
    const url = new URL(tool.url);
    for (const [k, v] of Object.entries(args)) url.searchParams.set(k, String(v));
    if (test) url.searchParams.set("test", "true");
    return { url: url.toString(), method: "GET", body: null as string | null, payload };
  }
  return { url: tool.url, method: tool.method, body: JSON.stringify(payload), payload };
}

/** Ready-made starting points. */
export const STARTERS: Record<string, { label: string; blurb: string; input: Omit<ToolInput, "url" | "headers" | "timeoutMs" | "sendContext" | "method"> }> = {
  calendar: {
    label: "Book in a calendar",
    blurb: "Send a booking to your calendar (e.g. through Zapier or Make to Google Calendar or Cal.com).",
    input: {
      name: "book_in_calendar",
      label: "Book in calendar",
      description: "Use after the person agrees a day and time for a meeting or visit and has given their name and phone number. Book it, then confirm the booking back to them.",
      parameters: [
        { name: "full_name", type: "text", required: true, description: "The person's full name" },
        { name: "phone", type: "phone", required: true, description: "The person's phone number" },
        { name: "date", type: "date", required: true, description: "The agreed date" },
        { name: "time", type: "time", required: true, description: "The agreed time" },
        { name: "notes", type: "text", required: false, description: "Anything else to note for the meeting" },
      ],
      waitMessage: "One moment while I book that for you.",
    },
  },
  crm_lead: {
    label: "Create a CRM lead",
    blurb: "Add the person to your CRM (HubSpot, Zoho, Salesforce, a Google Sheet…).",
    input: {
      name: "create_crm_lead",
      label: "Create CRM lead",
      description: "Use once the person has shown interest and given their name and at least a phone number or email, to save them as a lead.",
      parameters: [
        { name: "full_name", type: "text", required: true, description: "The person's full name" },
        { name: "phone", type: "phone", required: false, description: "Phone number" },
        { name: "email", type: "email", required: false, description: "Email address" },
        { name: "interest", type: "choice", required: true, description: "How interested they are", options: ["high", "medium", "low"] },
        { name: "notes", type: "text", required: false, description: "A short summary of what they want" },
      ],
      waitMessage: "",
    },
  },
  update_record: {
    label: "Update a record",
    blurb: "Change something on an existing record (e.g. a customer's status or contact details).",
    input: {
      name: "update_record",
      label: "Update record",
      description: "Use when the person gives new details for their existing record, such as a new phone number or address, after you have confirmed who they are.",
      parameters: [
        { name: "record_id", type: "text", required: true, description: "The record or customer number" },
        { name: "field", type: "text", required: true, description: "What is changing, e.g. phone or address" },
        { name: "new_value", type: "text", required: true, description: "The new value" },
      ],
      waitMessage: "Let me update that for you.",
    },
  },
  lookup: {
    label: "Look something up",
    blurb: "Fetch information during the call, e.g. an order or account status, and read it back.",
    input: {
      name: "lookup_status",
      label: "Look up status",
      description: "Use when the person asks about the status of their order, application or account and gives the reference number. Read the result back in plain words.",
      parameters: [{ name: "reference", type: "text", required: true, description: "The order, application or account reference" }],
      waitMessage: "Let me check that for you.",
    },
  },
  sheet: {
    label: "Send to a Google Sheet",
    blurb: "Add a row to a Google Sheet (through Zapier or Make).",
    input: {
      name: "add_sheet_row",
      label: "Add sheet row",
      description: "Use at the end of the call to record the person's details and the outcome.",
      parameters: [
        { name: "full_name", type: "text", required: false, description: "The person's name" },
        { name: "phone", type: "phone", required: false, description: "Phone number" },
        { name: "outcome", type: "text", required: true, description: "What happened on the call, in a few words" },
      ],
      waitMessage: "",
    },
  },
};
