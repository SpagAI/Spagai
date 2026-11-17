"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Small tabs inside a section (e.g. "Tools" and "MCP servers"). Both panels stay mounted
 * (only hidden), so anything typed in one is kept when switching.
 */
export function SubTabs({ tabs, initial, label }: { tabs: { id: string; label: string; count?: number; content: ReactNode }[]; initial?: string; label: string }) {
  const [active, setActive] = useState(initial ?? tabs[0]?.id);
  return (
    <div className="space-y-4">
      <div role="tablist" aria-label={label} className="inline-flex rounded-lg border bg-muted/40 p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active === t.id}
            onClick={() => setActive(t.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active === t.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            {t.count !== undefined && <span className="rounded-full bg-muted px-1.5 text-xs text-muted-foreground">{t.count}</span>}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.id} role="tabpanel" hidden={active !== t.id}>
          {t.content}
        </div>
      ))}
    </div>
  );
}
