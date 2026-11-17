"use client";

import { Bell, BellOff, Check, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

interface Version { commit: string; builtAt: string | null; message?: string }
interface Shipped { commit: string; message: string; at: string }

const POLL_MS = 20_000;

/** A short, pleasant three-note chime made in the browser (no sound file needed). */
function chime(ctx: AudioContext) {
  const start = ctx.currentTime + 0.05;
  [659.25, 880, 1318.5].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const t = start + i * 0.18;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.35, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 1);
  });
}

async function fetchVersion(): Promise<Version | null> {
  try {
    const res = await fetch(`/api/version?t=${Date.now()}`, { cache: "no-store" });
    return res.ok ? ((await res.json()) as Version) : null;
  } catch {
    return null;
  }
}

const time = (iso: string) => new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Africa/Lagos" }).format(new Date(iso));

export function ShipBell() {
  const [on, setOn] = useState(false);
  const [current, setCurrent] = useState<Version | null>(null);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [shipped, setShipped] = useState<Shipped[]>([]);
  const [notify, setNotify] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const lastRef = useRef<string | null>(null);

  useEffect(() => {
    void fetchVersion().then((v) => { if (v) { setCurrent(v); lastRef.current = v.commit; } });
  }, []);

  useEffect(() => {
    if (!on) return;
    const check = async () => {
      const v = await fetchVersion();
      setCheckedAt(new Date().toISOString());
      if (!v) return;
      setCurrent(v);
      if (lastRef.current && v.commit !== lastRef.current) {
        const item = { commit: v.commit, message: v.message || "A new update", at: new Date().toISOString() };
        setShipped((list) => [item, ...list].slice(0, 20));
        if (ctxRef.current) chime(ctxRef.current);
        if (notify && typeof Notification !== "undefined") new Notification("Shipped to the live site ✓", { body: item.message });
        document.title = "✓ Shipped! · Ship bell";
        setTimeout(() => { document.title = "Ship bell"; }, 15_000);
      }
      lastRef.current = v.commit;
    };
    void check();
    const t = setInterval(check, POLL_MS);
    return () => clearInterval(t);
  }, [on, notify]);

  const start = async () => {
    // Browsers only allow sound after a click, so the bell is switched on by a button.
    ctxRef.current ??= new AudioContext();
    await ctxRef.current.resume();
    chime(ctxRef.current);
    if (typeof Notification !== "undefined" && Notification.permission !== "denied") {
      setNotify((await Notification.requestPermission()) === "granted");
    }
    setOn(true);
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-6 px-4 py-10">
      <div className="space-y-2 text-center">
        <span className={`mx-auto grid size-16 place-items-center rounded-full ${on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
          {on ? <Bell className="size-7" /> : <BellOff className="size-7" />}
        </span>
        <h1 className="text-2xl font-semibold">Ship bell</h1>
        <p className="text-sm text-muted-foreground">Keep this tab open on your computer. When a new update of Spag AI Studio goes live, it plays a chime{notify ? " and shows a desktop notification" : ""}.</p>
      </div>

      {on ? (
        <div className="space-y-2 text-center">
          <p className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary"><span className="size-2 animate-pulse rounded-full bg-primary" /> Listening for updates</p>
          <p className="text-xs text-muted-foreground">Checks every 20 seconds{checkedAt ? ` · last check ${time(checkedAt)}` : ""}</p>
          <div className="flex justify-center gap-2">
            <Button variant="outline" size="sm" onClick={() => ctxRef.current && chime(ctxRef.current)}><Volume2 /> Test the sound</Button>
            <Button variant="ghost" size="sm" onClick={() => setOn(false)}>Turn off</Button>
          </div>
        </div>
      ) : (
        <Button size="lg" onClick={start}><Bell /> Turn on the ship bell</Button>
      )}

      <div className="space-y-2 rounded-xl border p-4 text-sm">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Live now</p>
        {current ? (
          <>
            <p className="font-medium">{current.message || "Current update"}</p>
            <p className="text-xs text-muted-foreground"><code>{current.commit.slice(0, 7)}</code>{current.builtAt ? ` · built ${time(current.builtAt)} (Lagos)` : ""}</p>
          </>
        ) : <p className="text-muted-foreground">Checking…</p>}
      </div>

      {shipped.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Shipped while this tab was open</p>
          <ul className="divide-y rounded-xl border">
            {shipped.map((s) => (
              <li key={s.commit + s.at} className="flex items-start gap-2 px-4 py-2.5 text-sm">
                <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                <span className="min-w-0 flex-1">{s.message}<span className="block text-xs text-muted-foreground">{time(s.at)} · <code>{s.commit.slice(0, 7)}</code></span></span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
