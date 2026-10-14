import { sanitiseForSpeech } from "@spagai/core";
import { z } from "zod";
import { env } from "@/server/env";
import { isWorkerAuthorised } from "@/server/worker-auth";

/**
 * For the voice worker (services/voice-worker): clean a line before text-to-speech,
 * using the same rules as the rest of the platform (architecture rule 4).
 * POST { "text": "..." } → { "spoken": "..." }
 */
export async function POST(request: Request): Promise<Response> {
  if (!isWorkerAuthorised(request.headers.get("authorization"), env.WORKER_SHARED_SECRET)) {
    return Response.json({ error: "unauthorised" }, { status: 401 });
  }
  const body = z.object({ text: z.string().max(4000) }).safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Send JSON like {\"text\": \"...\"} (up to 4000 characters)." }, { status: 400 });
  return Response.json({ spoken: sanitiseForSpeech(body.data.text) });
}
