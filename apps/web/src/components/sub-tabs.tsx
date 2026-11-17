"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SubTab {
  id: string;
  label: string;
  /** Shown as a tooltip on the tab. */
  description?: string;
  /** A ready-drawn icon, e.g. <Plug className="size-4" /> (works from server pages too). */
  icon?: ReactNode;
  count?: number;
  content: ReactNode;
}

/**
 * A compact switch inside a section (e.g. "Tools" and "MCP servers"): the chosen side is filled
 * purple, so it is clear which one you are on. Both panels stay mounted (only hidden), so anything
 * typed in one is kept when switching.
 */
export function SubTabs({ tabs, initial, label }: { tabs: SubTab[]; initial?: string; label: string }) {
  const [active, setActive] = useState(initial ?? tabs[0]?.id);
  return (
    <div className="space-y-4">
      <div role="tablist" aria-label={label} className="inline-flex rounded-lg border bg-muted/40 p-1">
        {tabs.map((t) => {
          const on = active === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={on}
              title={t.description}
              onClick={() => setActive(t.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors duration-150 [&_svg]:size-4",
                on ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-background hover:text-foreground",
              )}
            >
              {t.icon}
              {t.label}
              {t.count !== undefined && (
                <span className={cn("rounded-full px-1.5 text-xs", on ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground")}>{t.count}</span>
              )}
            </button>
          );
        })}
      </div>
      {tabs.map((t) => (
        <div key={t.id} role="tabpanel" hidden={active !== t.id}>
          {t.content}
        </div>
      ))}
    </div>
  );
}
