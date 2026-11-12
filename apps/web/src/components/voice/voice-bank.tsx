"use client";

import { Check, Heart, Loader2, Pause, Play, Plus, Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { addBankVoice, searchVoiceBank } from "@/app/(app)/voices/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { BankVoice } from "@/lib/voice-bank";
import { cn } from "@/lib/utils";

const SUGGESTIONS = ["Nigerian", "Nigerian female", "Pidgin", "Yoruba", "Igbo", "Hausa", "Ghanaian", "Customer service"];

function compact(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k` : String(n);
}

export interface VoiceBankProps {
  configured: boolean;
  canEdit: boolean;
  /** Fish Audio ids already in this workspace. */
  addedIds: string[];
}

/** Browse the Fish Audio voice library. Samples are Fish Audio's own recordings, so playing them is free. */
export function VoiceBank({ configured, canEdit, addedIds }: VoiceBankProps) {
  const [query, setQuery] = useState("Nigerian");
  const [gender, setGender] = useState<"" | "female" | "male">("");
  const [voices, setVoices] = useState<BankVoice[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  /** True once the first search has finished, so "No voices found" never shows while loading. */
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(() => new Set(addedIds));
  const [adding, setAdding] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [playing, setPlaying] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setAdded(new Set(addedIds));
  }, [addedIds]);

  const run = useCallback(async (q: string, g: typeof gender, p: number) => {
    setLoading(true);
    setError(null);
    const result = await searchVoiceBank({ query: q, gender: g, page: p });
    setLoading(false);
    setSearched(true);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setVoices((old) => (p === 1 ? result.page.voices : [...old, ...result.page.voices.filter((v) => !old.some((o) => o.providerVoiceId === v.providerVoiceId))]));
    setTotal(result.page.total);
    setPage(p);
    setHasMore(result.page.hasMore);
  }, []);

  useEffect(() => {
    if (configured) void run("Nigerian", "", 1);
    return () => audioRef.current?.pause();
  }, [configured, run]);

  const togglePlay = (v: BankVoice) => {
    audioRef.current?.pause();
    if (playing === v.providerVoiceId || !v.sampleUrl) {
      setPlaying(null);
      return;
    }
    const audio = new Audio(v.sampleUrl);
    audioRef.current = audio;
    setPlaying(v.providerVoiceId);
    audio.onended = () => setPlaying((id) => (id === v.providerVoiceId ? null : id));
    audio.onerror = () => {
      setPlaying(null);
      setError("That sample could not be played.");
    };
    void audio.play().catch(() => setPlaying(null));
  };

  const add = (v: BankVoice) => {
    setAdding(v.providerVoiceId);
    setError(null);
    startTransition(async () => {
      const result = await addBankVoice(v.providerVoiceId);
      setAdding(null);
      if (result.ok) setAdded((s) => new Set(s).add(v.providerVoiceId));
      else setError(result.message);
    });
  };

  return (
    <section className="space-y-4 rounded-xl border bg-card p-4 sm:p-5" aria-labelledby="voice-bank-title">
      <div className="space-y-1">
        <h2 id="voice-bank-title" className="text-lg font-semibold">Find more voices: Fish Audio voice bank</h2>
        <p className="text-sm text-muted-foreground">
          Search thousands of real voices, including Nigerian accents. Samples are free to play. Add the ones you like, then pick them for an agent.
        </p>
      </div>

      {!configured ? (
        <Alert>
          Fish Audio is not connected yet. Add your Fish Audio API key as <code className="font-mono text-xs">FISH_AUDIO_API_KEY</code> in the site&apos;s settings to browse and use real voices.
        </Alert>
      ) : (
        <>
          <form
            className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem_auto]"
            onSubmit={(e) => {
              e.preventDefault();
              void run(query.trim(), gender, 1);
            }}
          >
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} maxLength={60} onChange={(e) => setQuery(e.target.value)} placeholder="Search voices, e.g. Nigerian" className="pl-8" aria-label="Search the voice bank" />
            </div>
            <Select value={gender} onChange={(e) => setGender(e.target.value as typeof gender)} aria-label="Gender">
              <option value="">Any gender</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
            </Select>
            <Button type="submit" disabled={loading}>{loading && page === 1 ? <Loader2 className="animate-spin" /> : <Search />} Search</Button>
          </form>
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setQuery(s);
                  void run(s, gender, 1);
                }}
                className="rounded-full border px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {s}
              </button>
            ))}
          </div>

          {error && <Alert variant="destructive">{error}</Alert>}

          {!searched || (loading && voices.length === 0) ? (
            <p className="flex items-center justify-center gap-2 rounded-xl border border-dashed p-8 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading voices…</p>
          ) : voices.length === 0 ? (
            <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No voices found. Try another search.</p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">{total.toLocaleString("en-NG")} voices found</p>
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {voices.map((v) => {
                  const isPlaying = playing === v.providerVoiceId;
                  const isAdded = added.has(v.providerVoiceId);
                  return (
                    <li key={v.providerVoiceId} className={cn("flex flex-col gap-3 rounded-xl border p-4 transition-colors", isPlaying && "border-primary/60 ring-1 ring-primary/30")}>
                      <div className="flex items-start gap-3">
                        <button
                          type="button"
                          disabled={!v.sampleUrl}
                          onClick={() => togglePlay(v)}
                          aria-label={isPlaying ? `Stop ${v.name}` : `Play a sample of ${v.name}`}
                          className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {isPlaying ? <Pause className="size-5 fill-current" /> : <Play className="ml-0.5 size-5 fill-current" />}
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold" title={v.name}>{v.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {v.gender === "female" ? "Female" : "Male"} · {{ young: "Young", middle: "Middle-aged", mature: "Mature" }[v.age]} · {v.accent}
                          </p>
                        </div>
                      </div>
                      {v.description && <p className="line-clamp-2 text-sm text-muted-foreground">{v.description}</p>}
                      <div className="mt-auto flex items-center justify-between gap-2 border-t pt-3">
                        <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span className="rounded-full bg-muted px-2 py-0.5">{v.category}</span>
                          <span className="inline-flex items-center gap-0.5"><Heart className="size-3" /> {compact(v.likes)}</span>
                        </span>
                        {isAdded ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-primary"><Check className="size-3.5" /> Added</span>
                        ) : canEdit ? (
                          <Button type="button" size="sm" variant="outline" disabled={adding === v.providerVoiceId} onClick={() => add(v)}>
                            {adding === v.providerVoiceId ? <Loader2 className="animate-spin" /> : <Plus />} Add to my voices
                          </Button>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
              {hasMore && (
                <div className="flex justify-center">
                  <Button type="button" variant="outline" disabled={loading} onClick={() => void run(query.trim(), gender, page + 1)}>
                    {loading ? <Loader2 className="animate-spin" /> : null} Load more
                  </Button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
