/** Plain words for voice setting values, shown next to each slider. Pure, so it can be tested. */

/** Round to the slider's step so 0.1 + 0.2 shows as 0.3, not 0.30000000000000004. */
export const roundTo = (value: number, step: number) => Math.round(value / step) * step;

export function speedText(speed: number): string {
  const s = roundTo(speed, 0.1);
  const pct = Math.round((s - 1) * 100);
  return `${s.toFixed(1)}× · ${pct === 0 ? "normal speed" : pct > 0 ? `${pct}% faster` : `${-pct}% slower`}`;
}

export function volumeText(volume: number): string {
  const v = Math.round(volume);
  const n = Math.abs(v);
  const amount = n <= 3 ? "a little" : n <= 7 ? "" : "much";
  const word = v > 0 ? "louder" : "quieter";
  return v === 0 ? "0 · normal loudness" : `${v > 0 ? "+" : ""}${v} · ${amount ? `${amount} ${word}` : word}`;
}

/** Expressiveness is saved as 0 to 1 and shown as 0 to 10. */
export function expressText(expressiveness: number): string {
  const n = Math.round(expressiveness * 10);
  return `${n} / 10 · ${n <= 3 ? "steady, the same each time" : n <= 8 ? "natural" : "lively and varied"}`;
}
