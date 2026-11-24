import { describe, expect, it } from "vitest";
import { languageLine } from "@/lib/agent-language";

describe("languageLine", () => {
  it("adds nothing for English agents", () => {
    expect(languageLine("en-NG")).toBeNull();
    expect(languageLine(undefined)).toBeNull();
  });

  it("gives Pidgin agents a firm rule to reply only in Pidgin, with numbers in words", () => {
    const line = languageLine("pcm")!;
    expect(line).toMatch(/ONLY in Nigerian Pidgin, every single turn/);
    expect(line).toMatch(/numbers in words/);
  });

  it("asks Yoruba, Hausa and Igbo agents to reply in their language", () => {
    expect(languageLine("yo")).toMatch(/reply in Yoruba/);
    expect(languageLine("ha")).toMatch(/reply in Hausa/);
    expect(languageLine("ig")).toMatch(/reply in Igbo/);
  });
});

import { acceptRewrite, canRewriteInto, firstMessageRewriteInstruction, placeholdersOf } from "@/lib/agent-language";
import { defaultFirstMessage, defaultFirstMessageIn } from "@/lib/agent-direction";

describe("first message in the agent's language", () => {
  it("has ready-written Pidgin openings for both kinds of agent", () => {
    expect(defaultFirstMessage("outbound", "pcm")).toMatch(/na \{\{agent_name\}\} dey talk/);
    expect(defaultFirstMessage("inbound", "pcm")).toMatch(/Wetin I fit do for you/);
    expect(placeholdersOf(defaultFirstMessage("outbound", "pcm"))).toEqual(placeholdersOf(defaultFirstMessage("outbound")));
  });

  it("swaps a standard opening into Pidgin and back without the AI", () => {
    expect(defaultFirstMessageIn(defaultFirstMessage("outbound"), "pcm")).toBe(defaultFirstMessage("outbound", "pcm"));
    expect(defaultFirstMessageIn(defaultFirstMessage("inbound", "pcm"), "en-NG")).toBe(defaultFirstMessage("inbound"));
  });

  it("leaves the person's own wording, and languages without a ready line, to the AI", () => {
    expect(defaultFirstMessageIn("Good morning {{lead_name}}, na Kemi from Lekki Homes.", "pcm")).toBeNull();
    expect(defaultFirstMessageIn(defaultFirstMessage("outbound"), "yo")).toBeNull();
    expect(canRewriteInto("yo")).toBe(true);
    expect(canRewriteInto("fr")).toBe(false);
    expect(firstMessageRewriteInstruction("pcm")).toMatch(/Nigerian Pidgin/);
    expect(firstMessageRewriteInstruction("pcm")).toMatch(/\{\{agent_name\}\}/);
  });

  it("only accepts an AI rewrite that kept every placeholder", () => {
    const original = "Hello {{lead_name}}, this is {{agent_name}} from {{company_name}}.";
    expect(acceptRewrite(original, "“Hello {{lead_name}}, na {{agent_name}} from {{company_name}} dey talk.”")).toBe("Hello {{lead_name}}, na {{agent_name}} from {{company_name}} dey talk.");
    expect(acceptRewrite(original, "Hello, na {{agent_name}} from {{company_name}} dey talk.")).toBeNull();
    expect(acceptRewrite(original, "   ")).toBeNull();
  });
});
