import { describe, expect, it } from "vitest";
import { parseChatReply, toChatMessages, toOpenAiTools } from "@/server/providers/openai-format";

describe("toOpenAiTools", () => {
  it("describes only the agent's tools, with required parameters", () => {
    const tools = toOpenAiTools(["book_appointment", "end_call"]);
    expect(tools.map((t) => t.function.name)).toEqual(["book_appointment", "end_call"]);
    expect(tools[0]!.function.parameters.required).toEqual(["appointment_date", "appointment_time"]);
    expect(tools[0]!.function.parameters.properties.appointment_date).toMatchObject({ type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" });
  });
});

describe("toChatMessages", () => {
  it("maps the agent to assistant and the caller to user", () => {
    expect(toChatMessages("SYSTEM", [{ role: "agent", text: "Hello" }, { role: "caller", text: "Hi" }])).toEqual([
      { role: "system", content: "SYSTEM" },
      { role: "assistant", content: "Hello" },
      { role: "user", content: "Hi" },
    ]);
  });
});

describe("parseChatReply", () => {
  const reply = (message: unknown) => ({ choices: [{ message }] });

  it("reads text and tool calls", () => {
    const turn = parseChatReply(
      reply({
        content: " Goodbye. ",
        tool_calls: [{ function: { name: "end_call", arguments: '{"reason":"done"}' } }],
      }),
      ["end_call"],
    );
    expect(turn).toEqual({ text: "Goodbye.", toolCalls: [{ tool: "end_call", args: { reason: "done" } }], endsCall: true });
  });

  it("drops tools the agent does not have and keeps calls with broken arguments empty", () => {
    const turn = parseChatReply(
      reply({
        content: null,
        tool_calls: [
          { function: { name: "book_appointment", arguments: "{}" } },
          { function: { name: "save_lead_data", arguments: "not json" } },
        ],
      }),
      ["save_lead_data", "end_call"],
    );
    expect(turn.toolCalls).toEqual([{ tool: "save_lead_data", args: {} }]);
    expect(turn.endsCall).toBe(false);
  });

  it("fails clearly when there is no reply", () => {
    expect(() => parseChatReply({}, [])).toThrow("no reply");
  });
});
