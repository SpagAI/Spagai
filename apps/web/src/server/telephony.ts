import "server-only";
import { env } from "./env";

/**
 * The "phone system": the piece that carries live call audio between a SIP trunk and the agent.
 * Not connected yet (docs/DECISIONS.md D165). Everything the studio needs to call into it is
 * defined here, so plugging in a real one (LiveKit, a provider's voice API, or our own server)
 * only means implementing this interface.
 */

export interface TelephonyStatus {
  connected: boolean;
  /** Plain words for the person (what is missing, or which system is used). */
  message: string;
}

export interface TelephonySystem {
  status(): TelephonyStatus;
  /** Make the trunk known to the phone system (so its numbers can ring agents and agents can dial out). */
  registerTrunk(trunk: { id: string; host: string; port: number; transport: string; username: string; password: string; numbers: string[] }): Promise<{ ok: boolean; message: string }>;
  /** Ring a phone and connect it to an agent (outbound). */
  placeCall(call: { agentId: string; fromNumber: string; toNumber: string }): Promise<{ ok: boolean; message: string }>;
}

const notConnected: TelephonySystem = {
  status: () => ({ connected: false, message: "The phone system is not connected yet. Everything here is saved; calls start once it is plugged in." }),
  registerTrunk: async () => ({ ok: false, message: "Saved. It will be registered when the phone system is connected." }),
  placeCall: async () => ({ ok: false, message: "Real calls start once the phone system is connected. Until then, use Talk to agent to hear it." }),
};

export function getTelephony(): TelephonySystem {
  // Only the "not connected" system exists for now; TELEPHONY_PROVIDER will select a real one.
  void env.TELEPHONY_PROVIDER;
  return notConnected;
}
