"use client";

import { VOICE_PROVIDERS, type Voice } from "@spagai/core";
import { Check, ChevronDown, Pause, Play } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

/** A soft, distinct avatar colour for each voice (from its id), in the brand purple range. */
function avatarStyle(id: string) {
  const h = [...id].reduce((a, c) => (a * 33 + c.charCodeAt(0)) % 360, 11);
  const hue = 275 + (h % 40);
  return { background: `linear-gradient(135deg, oklch(0.74 0.11 ${hue}), oklch(0.52 0.14 ${hue + 30}))` };
}

function Bars() {
  return (
    <span className="flex h-3 items-end gap-[2px]" aria-hidden>
      {[0.5, 1, 0.65, 0.9].map((h, i) => (
        <span key={i} className="w-[2.5px] animate-[voicebar_0.9s_ease-in-out_infinite] rounded-full bg-primary" style={{ height: `${h * 100}%`, animationDelay: `${i * 0.12}s` }} />
      ))}
    </span>
  );
}

function VoiceRow({ v, selected, playing, onChoose, onPlay }: { v: Voice; selected: boolean; playing: boolean; onChoose: () => void; onPlay: () => void }) {
  const usable = v.status === "available";
  const meta = [v.gender === "female" ? "Female" : "Male", v.category, v.accent && v.accent !== "Nigerian" ? v.accent : null].filter(Boolean).join(" · ");
  return (
    <div
      className={cn(
        "group flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5 transition-all",
        selected ? "border-primary bg-primary/5 ring-1 ring-primary/40" : "border-transparent hover:border-border hover:bg-muted/40",
        !usable && "opacity-50",
      )}
    >
      {/* Listen: the avatar turns into a play button */}
      <button
        type="button"
        onClick={onPlay}
        disabled={!usable}
        aria-label={playing ? `Stop ${v.name}` : `Listen to ${v.name}`}
        className="relative grid size-10 shrink-0 place-items-center rounded-full text-sm font-semibold text-white shadow-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        style={avatarStyle(v.id)}
      >
        <span className={cn("transition-opacity group-hover:opacity-0", playing && "opacity-0")}>{v.name[0]}</span>
        <span className={cn("absolute inset-0 grid place-items-center rounded-full bg-black/25 opacity-0 transition-opacity group-hover:opacity-100", playing && "opacity-100")}>
          {playing ? <Pause className="size-4 fill-current" /> : <Play className="ml-0.5 size-4 fill-current" />}
        </span>
      </button>
      {/* Choose: the rest of the row */}
      <button type="button" onClick={onChoose} disabled={!usable} aria-pressed={selected} className="flex min-w-0 flex-1 items-center gap-2 text-left outline-none disabled:cursor-not-allowed">
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-sm font-semibold">{v.name}</span>
            <span className={cn("shrink-0 rounded px-1.5 py-px text-[10px] font-medium", v.provider === "fish_audio" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
              {VOICE_PROVIDERS[v.provider] ?? v.provider}
            </span>
          </span>
          <span className="block truncate text-xs text-muted-foreground">{usable ? meta : "Not connected"}</span>
        </span>
        {playing && <Bars />}
        {selected ? (
          <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"><Check className="size-3" /></span>
        ) : (
          <span className="shrink-0 rounded-md px-2 py-0.5 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">Use</span>
        )}
      </button>
    </div>
  );
}

/** Clean, minimal voice list: real voices first, demo voices folded away, a Female / Male filter. */
export function VoicePicker({ voices, selectedId, playingId, onChoose, onPlay }: {
  voices: Voice[];
  selectedId: string | null;
  playingId: string | null;
  onChoose: (id: string) => void;
  onPlay: (v: Voice) => void;
}) {
  const [gender, setGender] = useState<"" | "female" | "male">("");
  const shown = voices.filter((v) => !gender || v.gender === gender);
  const real = shown.filter((v) => v.provider === "fish_audio");
  const demo = shown.filter((v) => v.provider !== "fish_audio");
  const selectedIsDemo = demo.some((v) => v.id === selectedId);
  const [showDemo, setShowDemo] = useState(selectedIsDemo || real.length === 0);

  const row = (v: Voice) => (
    <VoiceRow key={v.id} v={v} selected={selectedId === v.id} playing={playingId === v.id} onChoose={() => onChoose(v.id)} onPlay={() => onPlay(v)} />
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">Choose a voice</p>
        <div className="inline-flex rounded-lg bg-muted p-0.5 text-xs" role="radiogroup" aria-label="Filter voices">
          {([["", "All"], ["female", "Female"], ["male", "Male"]] as const).map(([value, label]) => (
            <button
              key={label}
              type="button"
              role="radio"
              aria-checked={gender === value}
              onClick={() => setGender(value)}
              className={cn("rounded-md px-3 py-1 transition-colors", gender === value ? "bg-background font-medium shadow-xs" : "text-muted-foreground hover:text-foreground")}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {real.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{VOICE_PROVIDERS.fish_audio} · real voices ({real.length})</p>
          <div className="grid gap-1.5 sm:grid-cols-2">{real.map(row)}</div>
        </div>
      )}

      {demo.length > 0 && (
        <div className="space-y-1.5">
          <button type="button" onClick={() => setShowDemo((s) => !s)} className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground">
            Demo voices ({demo.length}) · browser speech for now <ChevronDown className={cn("size-3.5 transition-transform", showDemo && "rotate-180")} />
          </button>
          {showDemo && (
            <div className="space-y-3">
              {/* One group per provider, in the usual provider order */}
              {Object.keys(VOICE_PROVIDERS)
                .filter((p) => p !== "fish_audio" && demo.some((v) => v.provider === p))
                .map((p) => {
                  const list = demo.filter((v) => v.provider === p);
                  return (
                    <div key={p} className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground">{VOICE_PROVIDERS[p]} ({list.length})</p>
                      <div className="grid gap-1.5 sm:grid-cols-2">{list.map(row)}</div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {shown.length === 0 && <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No voices match this filter.</p>}
      <p className="text-xs text-muted-foreground">Press a voice&apos;s circle to hear it say your first message; press the name to use it.</p>
    </div>
  );
}
