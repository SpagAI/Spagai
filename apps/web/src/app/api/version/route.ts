/**
 * Which update the site is running (the git commit it was built from, and when).
 * Public and harmless: used to tell when a push has gone live.
 */
export const dynamic = "force-static";

export function GET() {
  return Response.json(
    { commit: process.env.BUILD_COMMIT ?? "unknown", builtAt: process.env.BUILD_TIME ?? null },
    { headers: { "cache-control": "no-store" } },
  );
}
