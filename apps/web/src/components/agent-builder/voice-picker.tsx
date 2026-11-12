"use client";

import { VOICE_PROVIDERS, type Voice } from "@spagai/core";
import { Check, Pause, Play } from "lucide-react";
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

/** Clean, minimal voice list: one tab per provider (Fish Audio first), and a Female / Male filter. */
export function VoicePicker({ voices, selectedId, playingId, onChoose, onPlay }: {
  voices: Voice[];
  selectedId: string | null;
  playingId: string | null;
  onChoose: (id: string) => void;
  onPlay: (v: Voice) => void;
}) {
  // Only working (real) voices are offered: Fish Audio. The other providers keep an empty tab
  // until they are connected.
  const PROVIDER_TABS = ["fish_audio", "elevenlabs", "cartesia", "openai"];
  const active = voices.filter((v) => v.provider === "fish_audio" && v.status === "available");
  const providers = PROVIDER_TABS;
  const chosen = voices.find((v) => v.id === selectedId);
  const [provider, setProvider] = useState("fish_audio");
  const [gender, setGender] = useState<"" | "female" | "male">("");
  const shown = active.filter((v) => v.provider === provider && (!gender || v.gender === gender));

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

      {/* One tab per provider */}
      <div role="tablist" aria-label="Voice providers" className="flex flex-wrap gap-1.5">
        {providers.map((p) => {
          const count = active.filter((v) => v.provider === p).length;
          const isOpen = provider === p;
          return (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={isOpen}
              onClick={() => setProvider(p)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors",
                isOpen ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              {VOICE_PROVIDERS[p] ?? p}
              <span className={cn("text-xs tabular-nums", isOpen ? "text-primary-foreground/80" : "text-muted-foreground/70")}>{count}</span>

            </button>
          );
        })}
      </div>
      {chosen && chosen.provider !== "fish_audio" && (
        <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs">
          This agent still uses <span className="font-medium">{chosen.name}</span> ({VOICE_PROVIDERS[chosen.provider] ?? chosen.provider}), a demo voice that is no longer offered. Choose a Fish Audio voice below.
        </p>
      )}

      {shown.length > 0 ? (
        <div className="grid gap-1.5 sm:grid-cols-2">
          {shown.map((v) => (
            <VoiceRow key={v.id} v={v} selected={selectedId === v.id} playing={playingId === v.id} onChoose={() => onChoose(v.id)} onPlay={() => onPlay(v)} />
          ))}
        </div>
      ) : provider !== "fish_audio" ? (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <p className="text-sm font-medium">{VOICE_PROVIDERS[provider] ?? provider} is not connected yet</p>
          <p className="mt-1 text-xs text-muted-foreground">Its voices will appear here once it is connected. For now, use the Fish Audio voices.</p>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No voices match this filter.</p>
      )}
      <p className="text-xs text-muted-foreground">Press a voice&apos;s circle to hear it say your first message; press the name to use it.</p>
    </div>
  );
}
