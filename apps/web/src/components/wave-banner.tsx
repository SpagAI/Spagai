"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A dark banner with a voice-agent sound wave: thin glowing purple bars mirrored around a
 * centre line. Bar heights follow smooth "speech" swells that drift left and right, so it
 * reads like someone speaking rather than random flicker. Drawn on a canvas so it stays
 * sharp; paused off-screen or in a background tab; still when reduced motion is preferred.
 */

const BG = "#09070f";
const FPS = 40;
/** CSS pixels between bars, and bar thickness. */
const GAP = 6;
const BAR = 2.2;
/** Overall strength of the bars (1 = full). Low, so the wave sits softly behind the text. */
const SOFTNESS = 0.55;

/** Speech swells: each drifts across the banner (dir -1 right to left, 1 left to right) and breathes. */
const SWELLS = [
  { pos: 0.18, dir: 1, speed: 0.018, width: 0.07, height: 0.75, beat: 1.3, phase: 0.0 },
  { pos: 0.42, dir: -1, speed: 0.012, width: 0.11, height: 1.0, beat: 0.9, phase: 1.7 },
  { pos: 0.63, dir: 1, speed: 0.015, width: 0.08, height: 0.85, beat: 1.6, phase: 3.1 },
  { pos: 0.86, dir: -1, speed: 0.02, width: 0.06, height: 0.7, beat: 1.1, phase: 4.4 },
] as const;

/** Wrap a position into 0..1 so swells loop around the banner. */
const wrap = (v: number) => v - Math.floor(v);

/** Wave height (0..1) at horizontal position x (0..1) and time t (seconds). */
function amplitude(x: number, t: number): number {
  let a = 0;
  for (const s of SWELLS) {
    const centre = wrap(s.pos + s.dir * s.speed * t);
    // Distance on a loop, so a swell leaving one side re-enters the other smoothly.
    const d = Math.min(Math.abs(x - centre), 1 - Math.abs(x - centre));
    const breathe = 0.55 + 0.45 * Math.sin(t * s.beat + s.phase);
    a += s.height * breathe * Math.exp(-(d * d) / (2 * s.width * s.width));
  }
  // Fine syllable-like ripples riding on the swells, moving both ways.
  const ripple = 0.72 + 0.18 * Math.sin(x * 92 - t * 2.1) + 0.1 * Math.sin(x * 47 + t * 1.4);
  // Quiet near the edges, like the reference.
  const edge = Math.pow(Math.sin(Math.PI * x), 0.7);
  // A higher floor and a gentle boost keep the wave full across the banner, with the swells still rising above it.
  return Math.min(1, 0.3 + 1.3 * a * ripple * edge);
}

function draw(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, dpr: number) {
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, w, h);

  // Centred, with the tallest bars reaching about 70% of the banner height.
  const cy = h * 0.5;
  const maxH = h * 0.36;

  // Soft glow behind the wave.
  const glow = ctx.createRadialGradient(w * 0.55, cy, 0, w * 0.55, cy, w * 0.55);
  glow.addColorStop(0, "rgba(124, 88, 232, 0.07)");
  glow.addColorStop(1, "rgba(124, 88, 232, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  const step = GAP * dpr;
  const count = Math.floor(w / step);
  const left = (w - (count - 1) * step) / 2;

  for (let i = 0; i < count; i++) {
    const x = left + i * step;
    const half = Math.max(1.5 * dpr, amplitude(x / w, t) * maxH);
    // Bright, near-white core at the centre line; purple towards the tips; fading out at the ends.
    const g = ctx.createLinearGradient(0, cy - half, 0, cy + half);
    g.addColorStop(0, "rgba(124, 88, 232, 0.12)");
    g.addColorStop(0.18, "rgba(124, 88, 232, 0.5)");
    g.addColorStop(0.5, "rgba(222, 212, 255, 0.6)");
    g.addColorStop(0.82, "rgba(124, 88, 232, 0.5)");
    g.addColorStop(1, "rgba(124, 88, 232, 0.12)");
    ctx.strokeStyle = g;

    // A wide faint pass for the glow, then the crisp bar.
    ctx.globalAlpha = 0.1;
    ctx.lineWidth = BAR * 3.2 * dpr;
    ctx.beginPath();
    ctx.moveTo(x, cy - half);
    ctx.lineTo(x, cy + half);
    ctx.stroke();

    ctx.globalAlpha = SOFTNESS;
    ctx.lineWidth = BAR * dpr;
    ctx.beginPath();
    ctx.moveTo(x, cy - half);
    ctx.lineTo(x, cy + half);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

export function WaveBanner({ children, className }: { children?: ReactNode; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let visible = true;
    let last = 0;
    let elapsed = 6; // start mid-phrase, so the first frame already looks like speech
    let size = { w: 0, h: 0, dpr: 1 };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      size = { w: canvas.width, h: canvas.height, dpr };
      draw(ctx, size.w, size.h, elapsed, size.dpr);
    };

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (!visible || document.hidden || reduceMotion.matches) {
        last = now;
        return;
      }
      const dt = now - last;
      if (dt < 1000 / FPS) return;
      elapsed += Math.min(dt, 100) / 1000;
      last = now;
      draw(ctx, size.w, size.h, elapsed, size.dpr);
    };

    const sizeObserver = new ResizeObserver(resize);
    sizeObserver.observe(canvas);
    const viewObserver = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
    });
    viewObserver.observe(canvas);
    resize();
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      sizeObserver.disconnect();
      viewObserver.disconnect();
    };
  }, []);

  return (
    <div className={cn("relative isolate overflow-hidden rounded-xl", className)} style={{ backgroundColor: BG }}>
      <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 -z-10 size-full" />
      {/* Soft shade along the bottom so text on top stays easy to read. */}
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-t from-[#09070f]/90 via-[#09070f]/20 to-transparent" />
      {children}
    </div>
  );
}
