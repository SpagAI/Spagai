"use client";

import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Day / night switch: a sky track with a sun that slides across to become a moon.
 * Day is the white (light) appearance; night is the black (dark) one.
 */
export function ThemeSwitch({ night, onChange, label }: { night: boolean; onChange: (night: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={night}
      aria-label={label}
      onClick={() => onChange(!night)}
      className={cn(
        "relative h-8 w-16 shrink-0 overflow-hidden rounded-full border transition-colors duration-300 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        night ? "border-white/15 bg-[#0b1020]" : "border-sky-300 bg-sky-200",
      )}
    >
      {/* Stars at night, a cloud by day */}
      <span aria-hidden className={cn("absolute inset-0 transition-opacity duration-300", night ? "opacity-100" : "opacity-0")}>
        <span className="absolute top-2 left-3 size-0.5 rounded-full bg-white" />
        <span className="absolute top-4 left-5 size-[3px] rounded-full bg-white/80" />
        <span className="absolute top-5 left-2.5 size-0.5 rounded-full bg-white/70" />
      </span>
      <span aria-hidden className={cn("absolute top-3 right-2.5 h-2 w-4 rounded-full bg-white transition-opacity duration-300", night ? "opacity-0" : "opacity-90")} />
      <span
        aria-hidden
        className={cn(
          "absolute top-0.5 left-0.5 grid size-6.5 place-items-center rounded-full shadow-md transition-[translate,background-color] duration-300 ease-out",
          night ? "translate-x-8 bg-slate-200 text-slate-700" : "translate-x-0 bg-amber-400 text-amber-50",
        )}
      >
        {night ? <Moon className="size-3.5 fill-current" /> : <Sun className="size-3.5" />}
      </span>
    </button>
  );
}
