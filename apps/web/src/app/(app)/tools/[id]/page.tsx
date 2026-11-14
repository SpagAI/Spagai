import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ContextKey, ToolInput } from "@/lib/custom-tools";
import { requirePermission } from "@/server/auth/session";
import { toolHeaders, toolParams } from "@/server/custom-tools";
import { db } from "@/server/db";
import { ToolForm, type RunRow } from "../tool-form";

export const metadata: Metadata = { title: "Edit tool" };

export default async function EditToolPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePermission("integration:manage");
  const { id } = await params;
  const tool = await db.tool.findFirst({ where: { id, organisationId: ctx.organisation.id }, include: { runs: { orderBy: { createdAt: "desc" }, take: 50 } } });
  if (!tool) notFound();
  const initial: ToolInput = {
    name: tool.name,
    label: tool.label,
    description: tool.description,
    parameters: toolParams(tool),
    url: tool.url,
    method: tool.method as ToolInput["method"],
    // Saved secrets are never sent to the browser: an empty value means "keep it".
    headers: toolHeaders(tool).map((h) => ({ name: h.name, value: h.secret ? "" : h.value, secret: h.secret })),
    sendContext: tool.sendContext as unknown as Record<ContextKey, boolean>,
    timeoutMs: tool.timeoutMs,
    waitMessage: tool.waitMessage,
  };
  const runs: RunRow[] = tool.runs.map((r) => ({
    id: r.id, source: r.source, ok: r.ok, status: r.status, durationMs: r.durationMs, response: r.response, request: r.request, createdAt: r.createdAt.toISOString(),
  }));
  return <ToolForm id={tool.id} initial={initial} runs={runs} />;
}
