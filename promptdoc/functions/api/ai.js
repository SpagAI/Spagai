// PromptDoc AI endpoint (Cloudflare Pages Function).
// GET  /api/ai -> { ready } tells the page whether AI checks are switched on.
// POST /api/ai { prompt } -> { text, truncated } or { error }.
// Needs the ANTHROPIC_API_KEY secret in the Pages project settings.
// Plain fetch keeps the site zero-build (no npm install step on deploy).

const MAX_PROMPT_CHARS = 60000;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export async function onRequestGet({ env }) {
  return json({ ready: Boolean(env.ANTHROPIC_API_KEY) });
}

export async function onRequestPost({ request, env }) {
  if (!env.ANTHROPIC_API_KEY) return json({ error: "not_granted" }, 503);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_request" }, 400);
  }
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) return json({ error: "invalid_request" }, 400);
  if (prompt.length > MAX_PROMPT_CHARS) return json({ error: "prompt_too_large" }, 413);

  let res;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        // Re-runs a declined request on a fallback model inside the same call.
        "anthropic-beta": "server-side-fallback-2026-07-01",
      },
      body: JSON.stringify({
        model: env.CLAUDE_MODEL || "claude-opus-5-5",
        max_tokens: 16000,
        output_config: { effort: "low" }, // short, fast answers for a live demo
        fallbacks: "default",
        messages: [{ role: "user", content: prompt }],
      }),
    });
  } catch {
    return json({ error: "upstream_error" }, 502);
  }

  const data = await res.json().catch(() => null);
  if (!res.ok || !data) {
    if (res.status === 429) return json({ error: "rate_limited" }, 429);
    return json({ error: "upstream_error" }, 502);
  }
  if (data.stop_reason === "refusal") return json({ error: "refused" }, 200);

  const text = (data.content || [])
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");
  if (!text.trim()) return json({ error: "empty_completion" }, 502);

  return json({ text, truncated: data.stop_reason === "max_tokens" });
}
