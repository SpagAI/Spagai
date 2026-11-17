"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SubTab {
  id: string;
  label: string;
  /** One short line under the label. */
  description?: string;
  /** A ready-drawn icon, e.g. <Plug className="size-5" /> (works from server pages too). */
  icon?: ReactNode;
  count?: number;
  content: ReactNode;
}

/**
 * Clear, large tabs inside a section (e.g. "Tools" and "MCP servers"): the chosen one is filled,
 * the other outlined, so it is always obvious which one you are on. Both panels stay mounted
 * (only hidden), so anything typed in one is kept when switching.
 */
export function SubTabs({ tabs, initial, label }: { tabs: SubTab[]; initial?: string; label: string }) {
  const [active, setActive] = useState(initial ?? tabs[0]?.id);
  return (
    <div className="space-y-5">
      <div role="tablist" aria-label={label} className="grid gap-3 sm:grid-cols-2">
        {tabs.map((t) => {
          const on = active === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setActive(t.id)}
              className={cn(
                "flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-colors duration-150",
                on
                  ? "border-primary bg-primary text-primary-foreground shadow-md"
                  : "border-border bg-card text-foreground hover:border-primary/50 hover:bg-primary/5",
              )}
            >
              {t.icon && (
                <span className={cn("grid size-10 shrink-0 place-items-center rounded-lg", on ? "bg-primary-foreground/15" : "bg-primary/10 text-primary")}>
                  {t.icon}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 font-semibold">
                  {t.label}
                  {t.count !== undefined && (
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", on ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground")}>{t.count}</span>
                  )}
                </span>
                {t.description && <span className={cn("block text-xs", on ? "text-primary-foreground/85" : "text-muted-foreground")}>{t.description}</span>}
              </span>
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
