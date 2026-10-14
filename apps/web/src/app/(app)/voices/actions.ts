"use server";

import { z } from "zod";
import { requirePermission } from "@/server/auth/session";
import { synthesise, type SpeechResult } from "@/server/providers";

/** Speak a line in one voice. The text is cleaned for speech on the server first. */
export async function previewVoice(voiceId: string, text: string): Promise<SpeechResult> {
  await requirePermission("agent:view");
  const input = z.object({ voiceId: z.string().min(1).max(100), text: z.string().max(1000) }).safeParse({ voiceId, text });
  if (!input.success) return { kind: "error", message: "That line is too long." };
  try {
    return await synthesise(input.data.voiceId, input.data.text);
  } catch {
    return { kind: "error", message: "The voice could not be played. Please try again." };
  }
}
