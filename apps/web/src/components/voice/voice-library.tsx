"use client";

import { LANGUAGE_NAMES, VOICE_CATALOGUE, VOICE_CATEGORIES, VOICE_PROVIDERS, type Voice } from "@spagai/core";
import { Info, Pause, Play, Search, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useSpeaker } from "./use-speaker";

const PRESETS: [string, string][] = [
  ["Greeting", "Good morning! This is your assistant from Spag AI. Is this a good time to talk?"],
  ["Appointment", "Just a reminder that your appointment is tomorrow at 10am. Shall I keep the booking for you?"],
  ["Payment", "Your payment of twenty-five thousand naira is due on Friday. Would you like me to send the account details?"],
  ["Sales", "We have a special offer this week on two-bedroom apartments in Lekki. Can I tell you more?"],
  ["Support", "I'm sorry about the delay. Let me check your order and get back to you right away."],
];

const PROVIDER_TABS = ["all", "spagai", "elevenlabs", "cartesia", "openai"] as const;

/** A soft, distinct avatar background for each voice (from its id), in the brand purple range. */
function avatarStyle(id: string) {
  const h = [...id].reduce((a, c) => (a * 33 + c.charCodeAt(0)) % 360, 11);
  const hue = 275 + (h % 40);
  return { background: `linear-gradient(135deg, oklch(0.72 0.12 ${hue}), oklch(0.5 0.13 ${hue + 30}))` };
}

function Bars({ playing }: { playing: boolean }) {
  return (
    <span className="flex h-4 items-end gap-[2px]" aria-hidden>
      {[0.5, 0.9, 0.6, 1, 0.7].map((h, i) => (
        <span
          key={i}
          className={cn("w-[3px] rounded-full bg-primary/70", playing && "animate-[voicebar_0.9s_ease-in-out_infinite]")}
          style={{ height: `${h * 100}%`, animationDelay: `${i * 0.12}s`, opacity: playing ? 1 : 0.35 }}
        />
      ))}
    </span>
  );
}

export function VoiceLibrary({ usedBy }: { usedBy: Record<string, { id: string; name: string }[]> }) {
  const speaker = useSpeaker();
  const [preset, setPreset] = useState(0);
  const [custom, setCustom] = useState("");
  const [provider, setProvider] = useState<(typeof PROVIDER_TABS)[number]>("all");
  const [gender, setGender] = useState("");
  const [category, setCategory] = useState("");
  const [language, setLanguage] = useState("");
  const [query, setQuery] = useState("");

  const voices = useMemo(() => {
    const q = query.trim().toLowerCase();
    return VOICE_CATALOGUE.filter(
      (v) =>
        (provider === "all" || v.provider === provider) &&
        (!gender || v.gender === gender) &&
        (!category || v.category === category) &&
        (!language || v.language === language) &&
        (!q || `${v.name} ${v.accent} ${v.description} ${v.category}`.toLowerCase().includes(q)),
    );
  }, [provider, gender, category, language, query]);
  const counts = useMemo(() => Object.fromEntries(PROVIDER_TABS.map((p) => [p, VOICE_CATALOGUE.filter((v) => p === "all" || v.provider === p).length])), []);
  const filtered = gender || category || language || query;

  // Non-English voices read their own sample unless the user typed something.
  const lineFor = (v: Voice) => custom.trim() || (v.language === "en-NG" ? PRESETS[preset]![1] : v.sampleText);

  return (
    <div className="space-y-5">
      <section className="space-y-3 rounded-xl border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label htmlFor="voice-line" className="text-sm font-semibold">Text to hear</Label>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Sample sentences">
            {PRESETS.map(([name], i) => (
              <button
                key={name}
                type="button"
                role="radio"
                aria-checked={!custom.trim() && preset === i}
                onClick={() => { setPreset(i); setCustom(""); }}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  !custom.trim() && preset === i ? "border-primary bg-primary/10 font-medium text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
        <div className="relative">
          <Textarea
            id="voice-line"
            rows={2}
            maxLength={500}
            value={custom}
            placeholder={PRESETS[preset]![1]}
            onChange={(e) => setCustom(e.target.value)}
            className="pr-10"
          />
          {custom && (
            <button type="button" onClick={() => setCustom("")} aria-label="Clear your text" className="absolute right-2 top-2 rounded p-1 text-muted-foreground hover:bg-muted"><X className="size-4" /></button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">Pick a sample sentence, or type your own. Press play on any voice to hear it.</p>
      </section>

      <div className="space-y-3">
        <div className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto border-b px-1">
          {PROVIDER_TABS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setProvider(p)}
              aria-pressed={provider === p}
              className={cn(
                "-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors",
                provider === p ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {p === "all" ? "All voices" : VOICE_PROVIDERS[p]}
              <span className="rounded-full bg-muted px-1.5 text-[11px] tabular-nums text-muted-foreground">{counts[p]}</span>
            </button>
          ))}
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, accent or style" className="pl-8" aria-label="Search voices" />
          </div>
          <Select value={gender} onChange={(e) => setGender(e.target.value)} aria-label="Gender">
            <option value="">Any gender</option><option value="female">Female</option><option value="male">Male</option>
          </Select>
          <Select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
            <option value="">All categories</option>
            {VOICE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
          <Select value={language} onChange={(e) => setLanguage(e.target.value)} aria-label="Language">
            <option value="">All languages</option>
            {Object.entries(LANGUAGE_NAMES).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
          </Select>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{voices.length} voice{voices.length === 1 ? "" : "s"}</span>
          {filtered && <button type="button" onClick={() => { setGender(""); setCategory(""); setLanguage(""); setQuery(""); }} className="hover:text-foreground hover:underline">Clear filters</button>}
        </div>
      </div>

      {speaker.error && <Alert variant="destructive">{speaker.error}</Alert>}

      {voices.length === 0 ? (
        <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">No voices match these filters.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {voices.map((v) => {
            const usable = v.status === "available";
            const playing = speaker.playingKey === v.id;
            const agents = usedBy[v.id] ?? [];
            return (
              <li key={v.id} className={cn("group flex flex-col gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-primary/40", playing && "border-primary/60 ring-1 ring-primary/30", !usable && "opacity-70")}>
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    disabled={!usable}
                    onClick={() => (playing ? speaker.stop() : void speaker.speak(v.id, lineFor(v)))}
                    aria-label={playing ? `Stop ${v.name}` : `Play ${v.name}`}
                    className="relative grid size-12 shrink-0 place-items-center rounded-full text-white shadow-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed"
                    style={avatarStyle(v.id)}
                  >
                    <span className="text-base font-semibold transition-opacity group-hover:opacity-0" style={{ opacity: playing ? 0 : undefined }}>{v.name[0]}</span>
                    <span className={cn("absolute inset-0 grid place-items-center rounded-full bg-black/25 opacity-0 transition-opacity group-hover:opacity-100", playing && "opacity-100")}>
                      {playing ? <Pause className="size-5 fill-current" /> : <Play className="ml-0.5 size-5 fill-current" />}
                    </span>
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-semibold">{v.name}</p>
                      <span className="shrink-0 rounded-md border px-1.5 py-0.5 text-[11px] text-muted-foreground">{VOICE_PROVIDERS[v.provider] ?? v.provider}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{v.gender === "female" ? "Female" : "Male"} · {v.accent} · {LANGUAGE_NAMES[v.language]}</p>
                  </div>
                </div>
                <p className="line-clamp-2 text-sm text-muted-foreground">{v.description}</p>
                <div className="mt-auto flex items-center justify-between gap-2 border-t pt-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <Bars playing={playing} />
                    <span className="truncate whitespace-nowrap rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{v.category}</span>
                    <span className="hidden whitespace-nowrap rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground 2xl:inline">{{ young: "Young", middle: "Middle-aged", mature: "Mature" }[v.age]}</span>
                  </div>
                  {usable ? (
                    agents.length ? (
                      <span className="truncate text-[11px] text-muted-foreground" title={agents.map((a) => a.name).join(", ")}>
                        Used by <Link href={`/agents/${agents[0]!.id}`} className="underline underline-offset-2">{agents[0]!.name}</Link>{agents.length > 1 ? ` +${agents.length - 1}` : ""}
                      </span>
                    ) : (
                      <Link href="/agents" className="shrink-0 text-[11px] font-medium text-primary hover:underline">Use in an agent</Link>
                    )
                  ) : (
                    <span className="text-[11px] text-muted-foreground">Not connected</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        Previews in this demo use your browser&apos;s built-in speech, so they show timing and wording, not the final voice quality.
      </p>
    </div>
  );
}
