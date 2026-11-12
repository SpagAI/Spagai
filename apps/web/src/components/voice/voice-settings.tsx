"use client";

import { DEFAULT_VOICE_SETTINGS, type VoiceSettings } from "@spagai/core";
import { RotateCcw } from "lucide-react";
import { Label } from "@/components/ui/label";
import { roundTo } from "@/lib/voice-settings-text";
import { Switch } from "@/components/ui/switch";
import { PlayVoiceButton } from "./play-voice-button";

/** One slim row: name, − slider +, and the chosen value at the right edge. */
function Slider({ id, label, value, min, max, step, show, onChange, hint }: {
  id: string; label: string; value: number; min: number; max: number; step: number; show: string;
  onChange: (v: number) => void; hint?: string;
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, roundTo(v, step)));
  const pct = ((value - min) / (max - min)) * 100;
  const stepBtn = "grid size-6 shrink-0 place-items-center rounded-full text-base leading-none text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30";
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)_3.5rem] items-center gap-3" title={hint}>
      <Label htmlFor={id} className="text-sm font-medium">{label}</Label>
      <div className="flex items-center gap-1.5">
        <button type="button" onClick={() => onChange(clamp(value - step))} disabled={value <= min} aria-label={`${label}: one step down`} className={stepBtn}>−</button>
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(clamp(Number(e.target.value)))}
          aria-valuetext={show}
          className="h-4 w-full cursor-pointer appearance-none bg-transparent focus-visible:outline-none
            [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-[linear-gradient(to_right,var(--color-primary)_var(--fill),var(--color-muted)_var(--fill))]
            [&::-webkit-slider-thumb]:-mt-1.5 [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow
            focus-visible:[&::-webkit-slider-thumb]:ring-4 focus-visible:[&::-webkit-slider-thumb]:ring-primary/25
            [&::-moz-range-track]:h-1 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-muted [&::-moz-range-progress]:h-1 [&::-moz-range-progress]:rounded-full [&::-moz-range-progress]:bg-primary
            [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-primary"
          style={{ ["--fill" as string]: `${pct}%` }}
        />
        <button type="button" onClick={() => onChange(clamp(value + step))} disabled={value >= max} aria-label={`${label}: one step up`} className={stepBtn}>+</button>
      </div>
      <span className="text-right text-sm font-semibold tabular-nums text-foreground" aria-live="polite">{show}</span>
    </div>
  );
}

export interface VoiceSettingsControlsProps {
  value: VoiceSettings;
  onChange: (next: VoiceSettings) => void;
  /** Voice and line for the "Hear it" button (hidden when there is no voice). */
  voiceId?: string | null;
  sampleText: string;
  /** True for real (Fish Audio) voices: every setting applies. */
  realVoice: boolean;
}

/** Speed, loudness, expressiveness and number reading for an agent's voice. */
export function VoiceSettingsControls({ value, onChange, voiceId, sampleText, realVoice }: VoiceSettingsControlsProps) {
  const set = (patch: Partial<VoiceSettings>) => onChange({ ...value, ...patch });
  const isDefault = JSON.stringify(value) === JSON.stringify(DEFAULT_VOICE_SETTINGS);
  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">Voice settings</p>
          <p className="text-xs text-muted-foreground">
            {realVoice ? "All settings change the real voice." : "Demo voices use speed and loudness only."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isDefault && (
            <button type="button" onClick={() => onChange(DEFAULT_VOICE_SETTINGS)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <RotateCcw className="size-3" /> Reset
            </button>
          )}
          {voiceId && (
            <span className="inline-flex items-center gap-2 text-xs font-medium">
              Hear it with these settings
              <PlayVoiceButton voiceId={voiceId} text={sampleText} settings={value} label="Hear it with these settings" />
            </span>
          )}
        </div>
      </div>
      <div className="space-y-3">
        <Slider id="vs-speed" label="Speed" value={value.speed} min={0.5} max={2} step={0.1} show={`${roundTo(value.speed, 0.1).toFixed(1)}×`} onChange={(speed) => set({ speed })} hint="0.5× (slow) to 2× (fast). 1.0× is normal." />
        <Slider id="vs-volume" label="Loudness" value={value.volume} min={-10} max={10} step={1} show={value.volume > 0 ? `+${value.volume}` : String(value.volume)} onChange={(volume) => set({ volume })} hint="−10 (quieter) to +10 (louder). 0 is normal." />
        <Slider id="vs-expr" label="Expressiveness" value={Math.round(value.expressiveness * 10)} min={0} max={10} step={1} show={`${Math.round(value.expressiveness * 10)}/10`} onChange={(n) => set({ expressiveness: n / 10 })} hint="0 (steady) to 10 (lively). 7 is normal." />
      </div>
      <div className="flex items-start justify-between gap-3 border-t pt-3">
        <div>
          <Label htmlFor="vs-numbers">Read numbers and dates naturally</Label>
          <p className="text-xs text-muted-foreground">Says “14/11/2026” as “the 14th of November”.{realVoice ? "" : " Real voices only."}</p>
        </div>
        <Switch id="vs-numbers" checked={value.naturalNumbers} onCheckedChange={(naturalNumbers) => set({ naturalNumbers })} />
      </div>
    </div>
  );
}
