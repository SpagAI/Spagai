"use client";

import { VOICE_PROVIDERS, type Voice } from "@spagai/core";
import { createContext, useContext, useState, type ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { PlayVoiceButton } from "@/components/voice/play-voice-button";

/**
 * The voice picked on the "Create an agent" page. One choice is shared by the
 * "start from scratch" form and every template form (each carries a hidden input).
 */
const VoiceChoice = createContext<{ voiceId: string; setVoiceId: (id: string) => void }>({ voiceId: "", setVoiceId: () => {} });

export function NewAgentVoiceProvider({ initial, children }: { initial: string; children: ReactNode }) {
  const [voiceId, setVoiceId] = useState(initial);
  return <VoiceChoice.Provider value={{ voiceId, setVoiceId }}>{children}</VoiceChoice.Provider>;
}

/** Put inside each create form. */
export function NewAgentVoiceInput() {
  return <input type="hidden" name="voiceId" value={useContext(VoiceChoice).voiceId} />;
}

export function NewAgentVoicePicker({ voices, company }: { voices: Voice[]; company: string }) {
  const { voiceId, setVoiceId } = useContext(VoiceChoice);
  const real = voices.filter((v) => v.provider === "fish_audio");
  const demo = voices.filter((v) => v.provider !== "fish_audio");
  const chosen = voices.find((v) => v.id === voiceId);
  const label = (v: Voice) => `${v.name} · ${v.gender === "female" ? "Female" : "Male"} · ${v.category}`;
  return (
    <div className="space-y-2">
      <Label htmlFor="new-agent-voice">Voice</Label>
      <div className="flex items-center gap-2">
        <Select id="new-agent-voice" value={voiceId} onChange={(e) => setVoiceId(e.target.value)} className="max-w-md">
          {real.length > 0 && (
            <optgroup label={`Real voices (${VOICE_PROVIDERS.fish_audio})`}>
              {real.map((v) => <option key={v.id} value={v.id}>{label(v)}</option>)}
            </optgroup>
          )}
          {demo.length > 0 && (
            <optgroup label="Demo voices (browser speech)">
              {demo.map((v) => <option key={v.id} value={v.id}>{label(v)}</option>)}
            </optgroup>
          )}
          <option value="">Choose later</option>
        </Select>
        {chosen && (
          <PlayVoiceButton
            voiceId={chosen.id}
            text={`Hello! This is your new assistant from ${company}. How can I help you today?`}
            label={`Hear ${chosen.name}`}
          />
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {chosen ? chosen.description : "You can pick a voice later in the Voice tab."} Used for English agents and templates; templates in other languages get a voice later.
      </p>
    </div>
  );
}
