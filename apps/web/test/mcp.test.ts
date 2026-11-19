import { describe, expect, it } from "vitest";
import { authHeaderValue, fullToolName, hostOf, mergeTools, parseToolList, readRpcReply, safeSchema, serverOf, toolResultText } from "@/lib/mcp";

describe("MCP helpers", () => {
  it("names tools for the AI and finds their server", () => {
    expect(fullToolName("make", "Book Appointment")).toBe("make__book_appointment");
    expect(fullToolName("make", "scenario-123")).toBe("make__scenario-123");
    expect(fullToolName("make", "x".repeat(100)).length).toBe(64);
    expect(serverOf("make__book_appointment")).toBe("make");
  });

  it("reads plain JSON and event-stream replies", () => {
    expect(readRpcReply('{"jsonrpc":"2.0","id":2,"result":{"ok":true}}', "application/json", 2)?.result).toEqual({ ok: true });
    const sse = 'event: message\ndata: {"jsonrpc":"2.0","method":"notifications/progress"}\n\nevent: message\ndata: {"jsonrpc":"2.0","id":3,"result":{"tools":[]}}\n\n';
    expect(readRpcReply(sse, "text/event-stream; charset=utf-8", 3)?.result).toEqual({ tools: [] });
    expect(readRpcReply("not json", "application/json", 1)).toBeNull();
    expect(readRpcReply('{"jsonrpc":"2.0","id":9,"error":{"code":-32601,"message":"nope"}}', "application/json", 9)?.error?.message).toBe("nope");
  });

  it("reads the tool list and keeps earlier choices", () => {
    const list = parseToolList({ tools: [{ name: "book", description: "Book a slot", inputSchema: { type: "object", properties: { date: { type: "string" } }, required: ["date"] } }, { name: "x" }, { nope: 1 }] });
    expect(list.map((t) => t.name)).toEqual(["book", "x"]);
    expect(list[1]!.inputSchema).toEqual({ type: "object", properties: {} });
    const merged = mergeTools([{ name: "book", description: "", inputSchema: {}, allowed: false }], list);
    expect(merged.map((t) => t.allowed)).toEqual([false, true]);
  });

  it("turns a tool result into text for the AI", () => {
    expect(toolResultText({ content: [{ type: "text", text: "Booked for 10:00" }] })).toEqual({ text: "Booked for 10:00", isError: false });
    expect(toolResultText({ content: [{ type: "text", text: "Slot taken" }], isError: true }).isError).toBe(true);
    expect(toolResultText({ structuredContent: { slots: ["10:00"] } }).text).toBe('{"slots":["10:00"]}');
    expect(toolResultText({}).text).toBe("Done.");
  });

  it("makes any schema safe and hides the secret address", () => {
    expect(safeSchema(null)).toEqual({ type: "object", properties: {} });
    expect(hostOf("https://eu2.make.com/mcp/u/SECRET/stateless")).toBe("eu2.make.com");
  });

  it("sends an access key as a Bearer token unless a scheme is given", () => {
    expect(authHeaderValue("abc123")).toBe("Bearer abc123");
    expect(authHeaderValue(" Bearer abc123 ")).toBe("Bearer abc123");
    expect(authHeaderValue("Basic dXNlcjpwYXNz")).toBe("Basic dXNlcjpwYXNz");
    expect(authHeaderValue("")).toBe("");
  });
});
