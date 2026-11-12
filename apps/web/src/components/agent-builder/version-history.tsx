"use client";

import type { AgentConfig } from "@spagai/core";
import { History, Loader2, RotateCcw, X } from "lucide-react";
import { useEffect, useState } from "react";
import { listAgentVersions, type AgentVersionSummary } from "@/app/(app)/agents/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatLagos } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Saved versions of an agent: look at an earlier prompt and put it back in the editor. */
export function VersionHistory({ agentId, onClose, onRestore }: { agentId: string; onClose: () => void; onRestore: (config: AgentConfig, savedAt: string) => void }) {
  const [data, setData] = useState<{ versions: AgentVersionSummary[]; configs: Record<string, AgentConfig> } | null>(null);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    listAgentVersions(agentId)
      .then((d) => {
        setData(d);
        setSelected(d.versions[0]?.id ?? null);
      })
      .catch(() => setFailed(true));
  }, [agentId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const version = data?.versions.find((v) => v.id === selected);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Version history"
        className="flex h-full w-full max-w-3xl flex-col bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b p-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold"><History className="size-5" /> Version history</h2>
            <p className="text-xs text-muted-foreground">A version is kept every time you press Save (the newest 50). Restoring puts it in the editor; press Save to keep it.</p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close"><X /></Button>
        </div>

        {failed ? (
          <p className="p-6 text-sm text-destructive">The history could not be loaded. Please try again.</p>
        ) : !data ? (
          <p className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading versions…</p>
        ) : data.versions.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No saved versions yet. Each time you press Save, a version is kept here.</p>
        ) : (
          <div className="grid min-h-0 flex-1 sm:grid-cols-[15rem_minmax(0,1fr)]">
            <ul className="max-h-48 overflow-y-auto border-b sm:max-h-none sm:border-r sm:border-b-0">
              {data.versions.map((v, i) => (
                <li key={v.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(v.id)}
                    className={cn("w-full space-y-0.5 border-b px-4 py-3 text-left text-sm hover:bg-muted", selected === v.id && "bg-primary/5")}
                  >
                    <span className="flex items-center gap-2 font-medium">
                      {formatLagos(v.savedAt)}
                      {i === 0 && <Badge variant="secondary">Latest</Badge>}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {v.savedBy ?? "Before your first save"} · {v.status === "READY" ? "Ready" : "Draft"} · {v.prompt.length.toLocaleString("en-NG")} characters
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {version && (
              <div className="flex min-h-0 flex-col">
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">First message</p>
                    <p className="text-sm">{version.firstMessage || "(empty)"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Prompt</p>
                    <pre className="whitespace-pre-wrap rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-relaxed">{version.prompt || "(empty)"}</pre>
                  </div>
                </div>
                <div className="border-t p-4">
                  <Button type="button" onClick={() => onRestore(data.configs[version.id]!, version.savedAt)}>
                    <RotateCcw /> Restore this version
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
