import { describe, expect, it } from "vitest";
import { buildRequest, cleanArguments, STARTERS, toJsonSchema, toolInputSchema, webhookUrlProblem } from "@/lib/custom-tools";

const tool = {
  name: "create_crm_lead",
  url: "https://hooks.zapier.com/hooks/catch/123/abc",
  method: "POST",
  sendContext: { agent: true, call: true, caller: true, lead: false, time: true },
};

describe("webhook addresses", () => {
  it("only allows public https addresses", () => {
    expect(webhookUrlProblem("https://hooks.zapier.com/hooks/catch/1/2")).toBeNull();
    expect(webhookUrlProblem("http://example.com/hook")).toMatch(/https/);
    expect(webhookUrlProblem("https://localhost/hook")).toMatch(/not reachable/);
    expect(webhookUrlProblem("https://192.168.1.5/hook")).toMatch(/Private/);
    expect(webhookUrlProblem("https://169.254.169.254/latest")).toMatch(/Private/);
    expect(webhookUrlProblem("https://10.0.0.1/")).toMatch(/Private/);
    expect(webhookUrlProblem("https://user:pass@example.com/")).toMatch(/header/);
    expect(webhookUrlProblem("not a url")).toMatch(/full web address/);
  });
});

describe("tool settings", () => {
  it("checks names and refuses built-in names", () => {
    const base = { ...STARTERS.crm_lead!.input, url: tool.url, method: "POST" as const, headers: [], sendContext: tool.sendContext, timeoutMs: 10000 };
    expect(toolInputSchema.safeParse(base).success).toBe(true);
    expect(toolInputSchema.safeParse({ ...base, name: "Create Lead" }).success).toBe(false);
    expect(toolInputSchema.safeParse({ ...base, name: "end_call" }).success).toBe(false);
    expect(toolInputSchema.safeParse({ ...base, timeoutMs: 60000 }).success).toBe(false);
  });

  it("turns the details table into what the AI reads", () => {
    const schema = toJsonSchema(STARTERS.calendar!.input.parameters);
    expect(schema.required).toEqual(["full_name", "phone", "date", "time"]);
    expect(schema.properties.date).toMatchObject({ type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" });
    expect(toJsonSchema(STARTERS.crm_lead!.input.parameters).properties.interest).toMatchObject({ enum: ["high", "medium", "low"] });
  });

  it("keeps only declared details and reports missing required ones", () => {
    const { values, missing } = cleanArguments(STARTERS.crm_lead!.input.parameters, { full_name: "Ngozi Adeyemi", interest: "high", hacked: "x" });
    expect(values).toEqual({ full_name: "Ngozi Adeyemi", interest: "high" });
    expect(missing).toEqual([]);
    expect(cleanArguments(STARTERS.calendar!.input.parameters, { full_name: "A" }).missing).toEqual(["phone", "date", "time"]);
  });
});

describe("what is sent", () => {
  it("POST sends the details and the chosen context as JSON", () => {
    const r = buildRequest(tool, { full_name: "Ngozi" }, { agent: { id: "a1", name: "Zara" }, callId: "c9", callerPhone: "08031234567", leadName: "Ngozi", now: new Date("2026-11-14T10:00:00Z") }, false);
    expect(JSON.parse(r.body!)).toEqual({ tool: "create_crm_lead", arguments: { full_name: "Ngozi" }, context: { agent: { id: "a1", name: "Zara" }, call_id: "c9", phone: "08031234567", time: "2026-11-14T10:00:00.000Z" }, test: false });
  });

  it("GET puts the details in the web address", () => {
    const r = buildRequest({ ...tool, method: "GET" }, { reference: "AB12" }, {}, true);
    expect(r.body).toBeNull();
    expect(r.url).toBe("https://hooks.zapier.com/hooks/catch/123/abc?reference=AB12&test=true");
  });
});
