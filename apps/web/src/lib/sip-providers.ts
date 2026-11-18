/**
 * Phone line providers a workspace can connect through a SIP trunk, with plain-words hints on where
 * to find each setting. Pure, so it can be tested. The live audio connection (the "phone system")
 * is plugged in separately: see src/server/telephony.ts and docs/DECISIONS.md D165.
 */

export type SipProviderId = "africas_talking" | "twilio" | "vonage" | "telnyx" | "plivo" | "other";

export interface SipProvider {
  id: SipProviderId;
  label: string;
  /** Example of the SIP address the provider gives you. */
  hostExample: string;
  /** Where to find the SIP address, username and password in the provider's dashboard. */
  whereToFind: string;
  defaultTransport: "udp" | "tcp" | "tls";
}

export const SIP_PROVIDERS: SipProvider[] = [
  {
    id: "africas_talking",
    label: "Africa's Talking",
    hostExample: "ng.sip.africastalking.com",
    whereToFind: "In your Africa's Talking dashboard, open Voice, then SIP. Your SIP address, username and password are listed with your phone numbers.",
    defaultTransport: "udp",
  },
  {
    id: "twilio",
    label: "Twilio",
    hostExample: "yourtrunk.pstn.twilio.com",
    whereToFind: "In Twilio, open Elastic SIP Trunking, then your trunk. The Termination SIP URI is the address; add a credential list for the username and password.",
    defaultTransport: "tls",
  },
  {
    id: "vonage",
    label: "Vonage",
    hostExample: "sip.nexmo.com",
    whereToFind: "In the Vonage dashboard, open SIP Trunking. The SIP domain is the address; your API key and secret are the username and password.",
    defaultTransport: "udp",
  },
  {
    id: "telnyx",
    label: "Telnyx",
    hostExample: "sip.telnyx.com",
    whereToFind: "In Telnyx, open SIP Trunking, then your connection. Choose credentials authentication to get a username and password.",
    defaultTransport: "udp",
  },
  {
    id: "plivo",
    label: "Plivo",
    hostExample: "yourtrunk.sip.plivo.com",
    whereToFind: "In Plivo, open Zentrunk (SIP Trunking), then your outbound trunk. The termination domain is the address; credentials give the username and password.",
    defaultTransport: "udp",
  },
  {
    id: "other",
    label: "Another SIP provider",
    hostExample: "sip.yourprovider.com",
    whereToFind: "Ask your provider for the SIP server address (also called termination URI or SIP domain), the port, and a SIP username and password.",
    defaultTransport: "udp",
  },
];

export const providerById = (id: string): SipProvider => SIP_PROVIDERS.find((p) => p.id === id) ?? SIP_PROVIDERS[SIP_PROVIDERS.length - 1]!;

/** A SIP address as people paste it ("sip:host:5060;transport=udp") reduced to the host name. */
export function cleanSipHost(raw: string): string {
  return raw.trim().replace(/^sips?:/i, "").replace(/^\/\//, "").replace(/^[^@]*@/, "").replace(/[;?].*$/, "").replace(/:\d+$/, "").replace(/\/.*$/, "").toLowerCase();
}

/** Phone numbers typed in any common way, as E.164; reports the first that is not a full international number. */
export function parseTrunkNumbers(raw: string): { numbers: string[]; bad?: string } {
  const numbers = raw.split(/[\n,;]+/).map((n) => n.replace(/[^\d+]/g, "")).filter(Boolean);
  const bad = numbers.find((n) => !/^\+\d{8,15}$/.test(n));
  return bad ? { numbers, bad } : { numbers: [...new Set(numbers)] };
}

export const DIRECTION_LABEL: Record<string, string> = {
  both: "Incoming and outgoing calls",
  inbound: "Incoming calls only",
  outbound: "Outgoing calls only",
};
