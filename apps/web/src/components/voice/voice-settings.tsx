"use client";

import { DEFAULT_VOICE_SETTINGS, type VoiceSettings } from "@spagai/core";
import { RotateCcw } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PlayVoiceButton } from "./play-voice-button";

function Slider({ id, label, value, min, max, step, show, left, right, onChange, note }: {
  id: string; label: string; value: number; min: number; max: number; step: number; show: string;
  left: string; right: string; onChange: (v: number) => void; note?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>{label}</Label>
        <span className="text-xs tabular-nums text-muted-foreground">{show}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary"
      />
      <div className="flex justify-between text-[11px] text-muted-foreground"><span>{left}</span><span>{right}</span></div>
      {note && <p className="text-[11px] text-muted-foreground">{note}</p>}
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
      <div className="grid gap-4 sm:grid-cols-3">
        <Slider id="vs-speed" label="Speed" value={value.speed} min={0.5} max={2} step={0.05} show={`${value.speed.toFixed(2).replace(/0$/, "")}×`} left="Slower" right="Faster" onChange={(speed) => set({ speed })} />
        <Slider id="vs-volume" label="Loudness" value={value.volume} min={-10} max={10} step={1} show={value.volume > 0 ? `+${value.volume}` : String(value.volume)} left="Quieter" right="Louder" onChange={(volume) => set({ volume })} note={!realVoice ? "Demo voices can only get quieter." : undefined} />
        <Slider id="vs-expr" label="Expressiveness" value={value.expressiveness} min={0} max={1} step={0.05} show={value.expressiveness < 0.4 ? "Steady" : value.expressiveness > 0.8 ? "Lively" : "Natural"} left="Steady, same each time" right="Lively, varied" onChange={(expressiveness) => set({ expressiveness })} note={realVoice ? "A subtle change." : "Real voices only."} />
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
