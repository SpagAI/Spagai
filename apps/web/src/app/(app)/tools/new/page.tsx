import type { Metadata } from "next";
import { STARTERS, type ToolInput } from "@/lib/custom-tools";
import { requirePermission } from "@/server/auth/session";
import { ToolForm } from "../tool-form";

export const metadata: Metadata = { title: "New tool" };

const BLANK: ToolInput = {
  name: "",
  label: "",
  description: "",
  parameters: [],
  url: "",
  method: "POST",
  headers: [],
  sendContext: { agent: true, call: true, caller: true, lead: true, time: true },
  timeoutMs: 10000,
  waitMessage: "",
};

export default async function NewToolPage({ searchParams }: { searchParams: Promise<{ starter?: string }> }) {
  await requirePermission("integration:manage");
  const { starter } = await searchParams;
  const s = starter ? STARTERS[starter] : undefined;
  return <ToolForm id={null} initial={s ? { ...BLANK, ...s.input } : BLANK} starterLabel={s?.label} />;
}
