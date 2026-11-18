import { describe, expect, it } from "vitest";
import { cleanSipHost, parseTrunkNumbers, providerById, SIP_PROVIDERS } from "@/lib/sip-providers";

describe("SIP providers", () => {
  it("offers the main providers and a catch-all", () => {
    expect(SIP_PROVIDERS.map((p) => p.label)).toEqual(["Africa's Talking", "Twilio", "Vonage", "Telnyx", "Plivo", "Another SIP provider"]);
    expect(providerById("twilio").defaultTransport).toBe("tls");
    expect(providerById("nonsense").id).toBe("other");
  });

  it("reduces a pasted SIP address to its host", () => {
    expect(cleanSipHost("sip:yourtrunk.pstn.twilio.com:5061;transport=tls")).toBe("yourtrunk.pstn.twilio.com");
    expect(cleanSipHost("sip:user@NG.sip.africastalking.com")).toBe("ng.sip.africastalking.com");
    expect(cleanSipHost("sip.telnyx.com")).toBe("sip.telnyx.com");
  });

  it("reads numbers typed in any common way", () => {
    expect(parseTrunkNumbers("+234 901 234 5678, +2349012345678\n+14155550100")).toEqual({ numbers: ["+2349012345678", "+14155550100"] });
    expect(parseTrunkNumbers("09012345678").bad).toBe("09012345678");
  });
});
