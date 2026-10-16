"use client";

import { Pause, Play, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadBrowserVoices, pickBrowserVoice } from "@/components/voice/use-speaker";
import { cn } from "@/lib/utils";

export interface Turn { role: "agent" | "caller" | string; text: string }

/**
 * The call recording. In this demo there is no audio file: each line of the conversation is played
 * with the browser's own voices at its place on the call's timeline, so play, pause, seeking and the
 * call length all behave like a real recording.
 */

const SPEECH_RATE = 2.6; // words a second
const LEAD_IN = 0.6;
const BARS = 120;

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** When each line starts and how long it is spoken, fitted to the call length. */
function timeline(turns: Turn[], duration: number) {
  const spoken = turns.map((t) => t.text.split(/\s+/).length / SPEECH_RATE + 0.5);
  const total = spoken.reduce((a, b) => a + b, 0);
  const room = Math.max(duration - LEAD_IN, 1);
  const squeeze = total > room ? room / total : 1;
  const gap = total < room ? (room - total) / turns.length : 0;
  let at = LEAD_IN;
  return turns.map((_, i) => {
    const start = at;
    const length = spoken[i]! * squeeze;
    at += length + gap;
    return { start, length };
  });
}

export function CallPlayer({ callId, turns, duration, agentName, callerName, agentGender, callerGender }: {
  callId: string;
  turns: Turn[];
  duration: number;
  agentName: string;
  callerName: string;
  agentGender: "female" | "male";
  callerGender: "female" | "male";
}) {
  const marks = useMemo(() => timeline(turns, duration), [turns, duration]);
  const squeeze = useMemo(() => {
    const natural = turns.reduce((s, t) => s + t.text.split(/\s+/).length / SPEECH_RATE + 0.5, 0);
    return Math.min(1, Math.max(duration - LEAD_IN, 1) / natural);
  }, [turns, duration]);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [unsupported, setUnsupported] = useState(false);
  const engine = useRef({ time: 0, next: 0, speaking: -1, spokeAt: 0, last: 0, timer: 0 as ReturnType<typeof setInterval> | 0, voices: [] as SpeechSynthesisVoice[] });
  const track = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLOListElement>(null);

  useEffect(() => {
    if (!("speechSynthesis" in window)) { setUnsupported(true); return; }
    void loadBrowserVoices().then((v) => { engine.current.voices = v; });
    const e = engine.current;
    return () => { clearInterval(e.timer); window.speechSynthesis.cancel(); };
  }, []);

  const speak = useCallback((i: number) => {
    const e = engine.current;
    const turn = turns[i]!;
    const u = new SpeechSynthesisUtterance(turn.text);
    const isAgent = turn.role === "agent";
    const voice = pickBrowserVoice(e.voices, "en-NG", isAgent ? agentGender : callerGender);
    if (voice) u.voice = voice;
    u.pitch = isAgent ? (agentGender === "female" ? 1.1 : 0.85) : (callerGender === "female" ? 1.2 : 0.75);
    u.rate = Math.min(1.7, 1 / squeeze);
    u.onend = u.onerror = () => { if (e.speaking === i) e.speaking = -1; };
    e.speaking = i;
    e.spokeAt = performance.now();
    e.next = i + 1;
    window.speechSynthesis.speak(u);
  }, [turns, agentGender, callerGender, squeeze]);

  const stopSpeech = () => { engine.current.speaking = -1; window.speechSynthesis?.cancel(); };

  // The clock runs on a timer (not animation frames), so it keeps time even when the tab is in the background.
  const tick = useCallback(() => {
    const e = engine.current;
    const now = performance.now();
    const dt = Math.min((now - e.last) / 1000, 0.5);
    e.last = now;
    // If the browser never reports the end of a line (some voices don't), move on after a fair wait.
    if (e.speaking >= 0 && now - e.spokeAt > (marks[e.speaking]!.length * 2 + 3) * 1000) e.speaking = -1;
    const nextStart = marks[e.next]?.start ?? duration;
    // While a line is being spoken, the clock waits for it before moving on to the next line.
    e.time = e.speaking >= 0 ? Math.min(e.time + dt, Math.max(nextStart - 0.05, e.time)) : e.time + dt;
    if (e.speaking < 0 && e.next < turns.length && e.time >= marks[e.next]!.start) speak(e.next);
    if (e.time >= duration && e.speaking < 0) {
      clearInterval(e.timer);
      e.time = duration;
      setTime(duration);
      setPlaying(false);
      return;
    }
    setTime(e.time);
  }, [marks, duration, turns.length, speak]);

  const play = () => {
    const e = engine.current;
    if (e.time >= duration - 0.05) { e.time = 0; e.next = 0; }
    e.last = performance.now();
    setPlaying(true);
    clearInterval(e.timer);
    e.timer = setInterval(tick, 50);
  };

  const pause = () => {
    const e = engine.current;
    clearInterval(e.timer);
    // Resume from the start of the line that was playing.
    if (e.speaking >= 0) { e.next = e.speaking; e.time = marks[e.speaking]!.start; setTime(e.time); }
    stopSpeech();
    setPlaying(false);
  };

  const seek = useCallback((t: number) => {
    const e = engine.current;
    stopSpeech();
    e.time = Math.max(0, Math.min(duration, t));
    // Jumping into the middle of a line plays that line; otherwise wait for the next one.
    const inside = marks.findIndex((m) => e.time >= m.start && e.time < m.start + m.length);
    e.next = inside >= 0 ? inside : marks.findIndex((m) => m.start >= e.time) === -1 ? turns.length : marks.findIndex((m) => m.start >= e.time);
    setTime(e.time);
  }, [duration, marks, turns.length]);

  // Click or drag anywhere on the waveform to jump.
  const dragging = useRef(false);
  const fromPointer = (clientX: number) => {
    const r = track.current!.getBoundingClientRect();
    seek(((clientX - r.left) / r.width) * duration);
  };

  const active = marks.findIndex((m, i) => time >= m.start && time < (marks[i + 1]?.start ?? Infinity));
  useEffect(() => {
    const el = list.current?.children[active] as HTMLElement | undefined;
    const box = list.current;
    if (!el || !box || !playing) return;
    if (el.offsetTop < box.scrollTop || el.offsetTop + el.offsetHeight > box.scrollTop + box.clientHeight) {
      box.scrollTo({ top: el.offsetTop - box.clientHeight / 3, behavior: "smooth" });
    }
  }, [active, playing]);

  // A waveform shaped by the conversation: tall where someone speaks, flat in the pauses.
  const bars = useMemo(() => {
    let h = [...callId].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 17);
    return Array.from({ length: BARS }, (_, b) => {
      const t = ((b + 0.5) / BARS) * duration;
      const i = marks.findIndex((m) => t >= m.start && t < m.start + m.length);
      h = (h * 1103515245 + 12345) >>> 0;
      const jitter = (h % 1000) / 1000;
      return { t, role: i >= 0 ? turns[i]!.role : null, amp: i >= 0 ? 0.35 + jitter * 0.65 : 0.06 + jitter * 0.06 };
    });
  }, [callId, duration, marks, turns]);

  const colour = (role: string | null) => (role === "caller" ? "var(--chart-2)" : "var(--chart-1)");

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section id="recording" className="flex scroll-mt-24 flex-col gap-4 rounded-xl border bg-card p-4 sm:p-5">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">Call recording</h2>
            <p className="text-xs text-muted-foreground">Demo recording, played with your browser&apos;s voices</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-[3px]" style={{ background: "var(--chart-1)" }} /> {agentName}</span>
            <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-[3px]" style={{ background: "var(--chart-2)" }} /> {callerName}</span>
          </div>
        </header>

        <div
          ref={track}
          role="slider"
          tabIndex={0}
          aria-label="Recording position"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(time)}
          aria-valuetext={`${mmss(time)} of ${mmss(duration)}`}
          onPointerDown={(e) => { dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); fromPointer(e.clientX); }}
          onPointerMove={(e) => { if (dragging.current) fromPointer(e.clientX); }}
          onPointerUp={(e) => { dragging.current = false; e.currentTarget.releasePointerCapture(e.pointerId); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") { e.preventDefault(); seek(time + 5); }
            if (e.key === "ArrowLeft") { e.preventDefault(); seek(time - 5); }
            if (e.key === " " || e.key === "Enter") { e.preventDefault(); if (playing) pause(); else play(); }
          }}
          className="group relative flex h-20 cursor-pointer touch-none items-center gap-[2px] rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {bars.map((b, i) => (
            <span
              key={i}
              className="flex-1 rounded-full transition-opacity"
              style={{ height: `${b.amp * 100}%`, background: b.role ? colour(b.role) : "var(--muted-foreground)", opacity: b.t <= time ? 1 : 0.28 }}
            />
          ))}
          <span className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 rounded-full bg-foreground" style={{ left: `${(time / duration) * 100}%` }} aria-hidden />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => (playing ? pause() : play())}
            disabled={unsupported}
            aria-label={playing ? "Pause recording" : "Play recording"}
            className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {playing ? <Pause className="size-5 fill-current" /> : time >= duration - 0.05 && time > 0 ? <RotateCcw className="size-5" /> : <Play className="ml-0.5 size-5 fill-current" />}
          </button>
          <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
            <div className="h-full rounded-full bg-primary" style={{ width: `${(time / duration) * 100}%` }} />
          </div>
          <span className="w-24 text-right text-sm tabular-nums text-muted-foreground"><span className="text-foreground">{mmss(time)}</span> / {mmss(duration)}</span>
        </div>
        {unsupported && <p className="text-xs text-destructive">This browser cannot play the demo recording. Try Chrome or Edge.</p>}
      </section>

      <section className="flex min-h-0 flex-col rounded-xl border bg-card">
        <header className="border-b px-4 py-3 sm:px-5">
          <h2 className="text-sm font-semibold">Transcript</h2>
          <p className="text-xs text-muted-foreground">Click a line to play from there</p>
        </header>
        <ol ref={list} className="relative max-h-80 space-y-1 overflow-y-auto p-2 lg:max-h-[19rem]">
          {turns.map((t, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => { seek(marks[i]!.start); if (!playing) play(); }}
                className={cn("flex w-full gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted", i === active && "bg-accent")}
              >
                <span className="w-9 shrink-0 pt-0.5 text-xs tabular-nums text-muted-foreground">{mmss(marks[i]!.start)}</span>
                <span className="min-w-0">
                  <span className="mb-0.5 flex items-center gap-1.5 text-xs font-medium">
                    <span className="size-2 rounded-[2px]" style={{ background: colour(t.role) }} aria-hidden />
                    {t.role === "agent" ? agentName : callerName}
                  </span>
                  <span className={cn(i === active ? "text-foreground" : "text-muted-foreground")}>{t.text}</span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
