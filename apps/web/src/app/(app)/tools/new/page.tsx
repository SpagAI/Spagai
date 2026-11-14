import type { Metadata } from "next";
import { BLANK_TOOL, STARTERS } from "@/lib/custom-tools";
import { requirePermission } from "@/server/auth/session";
import { ToolForm } from "../tool-form";

export const metadata: Metadata = { title: "New tool" };

export default async function NewToolPage({ searchParams }: { searchParams: Promise<{ starter?: string }> }) {
  await requirePermission("integration:manage");
  const { starter } = await searchParams;
  const s = starter ? STARTERS[starter] : undefined;
  return <ToolForm id={null} initial={s ? { ...BLANK_TOOL, ...s.input } : BLANK_TOOL} starterLabel={s?.label} />;
}
