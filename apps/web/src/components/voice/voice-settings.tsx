"use client";

import { DEFAULT_VOICE_SETTINGS, type VoiceSettings } from "@spagai/core";
import { RotateCcw } from "lucide-react";
import { Label } from "@/components/ui/label";
import { expressText, roundTo, speedText, volumeText } from "@/lib/voice-settings-text";
import { Switch } from "@/components/ui/switch";
import { PlayVoiceButton } from "./play-voice-button";

/**
 * A clear slider: name and current value on top, − and + buttons that move exactly one step,
 * a thick filled track with a big handle, and a marked scale underneath.
 */
function Slider({ id, label, value, min, max, step, text, marks, defaultValue, onChange, note }: {
  id: string; label: string; value: number; min: number; max: number; step: number; text: string;
  marks: { at: number; label: string }[]; defaultValue: number; onChange: (v: number) => void; note?: string;
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, roundTo(v, step)));
  const pct = ((value - min) / (max - min)) * 100;
  const isDefault = Math.abs(value - defaultValue) < step / 2;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Label htmlFor={id} className="text-sm font-semibold">{label}</Label>
        <span className="rounded-md bg-primary/10 px-2 py-0.5 text-sm font-medium tabular-nums text-primary" aria-live="polite">{text}</span>
      </div>
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => onChange(clamp(value - step))} disabled={value <= min} aria-label={`${label}: one step down`} className="grid size-8 shrink-0 place-items-center rounded-full border bg-card text-lg leading-none hover:border-primary/50 hover:text-primary disabled:opacity-40">−</button>
        <div className="flex-1">
          <input
            id={id}
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(clamp(Number(e.target.value)))}
            aria-valuetext={text}
            className="h-6 w-full cursor-pointer appearance-none bg-transparent focus-visible:outline-none
              [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-[linear-gradient(to_right,var(--color-primary)_var(--fill),var(--color-muted)_var(--fill))]
              [&::-webkit-slider-thumb]:-mt-2 [&::-webkit-slider-thumb]:size-6 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:bg-background [&::-webkit-slider-thumb]:shadow-md
              focus-visible:[&::-webkit-slider-thumb]:ring-4 focus-visible:[&::-webkit-slider-thumb]:ring-primary/30
              [&::-moz-range-track]:h-2 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-muted [&::-moz-range-progress]:h-2 [&::-moz-range-progress]:rounded-full [&::-moz-range-progress]:bg-primary
              [&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:border-primary [&::-moz-range-thumb]:bg-background"
            style={{ ["--fill" as string]: `${pct}%` }}
          />
        </div>
        <button type="button" onClick={() => onChange(clamp(value + step))} disabled={value >= max} aria-label={`${label}: one step up`} className="grid size-8 shrink-0 place-items-center rounded-full border bg-card text-lg leading-none hover:border-primary/50 hover:text-primary disabled:opacity-40">+</button>
      </div>
      {/* Marked scale, lined up under the track (the − and + buttons are 2rem wide plus the gap) */}
      <div className="relative mx-11 -mt-1 h-8 text-[11px] text-muted-foreground">
            {marks.map((m) => {
              const left = ((m.at - min) / (max - min)) * 100;
              const isDef = Math.abs(m.at - defaultValue) < step / 2;
              return (
                <span key={m.at} className="absolute -translate-x-1/2 text-center whitespace-nowrap" style={{ left: `calc(${left}% + ${(0.5 - left / 100) * 24}px)` }}>
                  <span className={`mx-auto block h-1.5 w-px ${isDef ? "bg-primary" : "bg-muted-foreground/40"}`} />
                  <span className={isDef ? "font-medium text-foreground" : undefined}>{m.label}</span>
                  {isDef && <span className="block text-[10px] text-primary">default</span>}
                </span>
              );
            })}
          </div>

      <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
        <span>{note ?? `Each − or + is one step of ${step === 1 ? "1" : step}.`}</span>
        {!isDefault && <button type="button" onClick={() => onChange(defaultValue)} className="text-primary hover:underline">Back to default</button>}
      </div>
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
            {realVoice ? "All settings change the real voice." : "Demo voices use speed and loudness only. Choose a Fish Audio voice to use every setting."}
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
      <div className="space-y-5">
        <Slider
          id="vs-speed" label="Speed" value={value.speed} min={0.5} max={2} step={0.1} defaultValue={DEFAULT_VOICE_SETTINGS.speed}
          text={speedText(value.speed)}
          marks={[{ at: 0.5, label: "0.5×" }, { at: 1, label: "1.0×" }, { at: 1.5, label: "1.5×" }, { at: 2, label: "2.0×" }]}
          onChange={(speed) => set({ speed })}
          note="Each − or + changes the speed by 0.1× (10%)."
        />
        <Slider
          id="vs-volume" label="Loudness" value={value.volume} min={-10} max={10} step={1} defaultValue={DEFAULT_VOICE_SETTINGS.volume}
          text={volumeText(value.volume)}
          marks={[{ at: -10, label: "−10" }, { at: -5, label: "−5" }, { at: 0, label: "0" }, { at: 5, label: "+5" }, { at: 10, label: "+10" }]}
          onChange={(volume) => set({ volume })}
          note={realVoice ? "Each − or + is one step louder or quieter." : "Each − or + is one step. Demo voices can only get quieter."}
        />
        <Slider
          id="vs-expr" label="Expressiveness" value={Math.round(value.expressiveness * 10)} min={0} max={10} step={1} defaultValue={Math.round(DEFAULT_VOICE_SETTINGS.expressiveness * 10)}
          text={expressText(value.expressiveness)}
          marks={[{ at: 0, label: "0" }, { at: 3, label: "3" }, { at: 7, label: "7" }, { at: 10, label: "10" }]}
          onChange={(n) => set({ expressiveness: n / 10 })}
          note={realVoice ? "Each − or + is one point out of 10. The change is subtle." : "Real voices only."}
        />
      </div>
      <div className="flex items-start justify-between gap-3 border-t pt-3">
        <div>
          <Label htmlFor="vs-numbers">Read numbers and dates naturally</Label>
          <p className="text-xs text-muted-foreground">On: “14/11/2026” is read as “the 14th of November 2026”. Off: read as written, like “fourteen eleven two thousand twenty-six”. {realVoice ? "" : "Real voices only."}</p>
        </div>
        <Switch id="vs-numbers" checked={value.naturalNumbers} onCheckedChange={(naturalNumbers) => set({ naturalNumbers })} />
      </div>
    </div>
  );
}
