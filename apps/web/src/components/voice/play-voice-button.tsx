"use client";

import type { VoiceSettings } from "@spagai/core";
import { Pause, Play } from "lucide-react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useSpeaker } from "./use-speaker";

/** Only one of these buttons plays at a time: starting one stops the last. */
let stopLast: (() => void) | null = null;

export interface PlayVoiceButtonProps {
  voiceId: string;
  text: string;
  /** e.g. "Hear Amaka's voice" */
  label: string;
  className?: string;
  /** The agent's voice settings (speed, loudness...). */
  settings?: VoiceSettings;
}

/** A small round play button that says `text` in a voice (real speech for Fish Audio voices). */
export function PlayVoiceButton({ voiceId, text, label, className, settings }: PlayVoiceButtonProps) {
  const speaker = useSpeaker();
  const playing = speaker.playingKey !== null;
  const stopRef = useRef(speaker.stop);
  stopRef.current = speaker.stop;

  useEffect(() => () => {
    if (stopLast === stopRef.current) stopLast = null;
  }, []);

  const toggle = async () => {
    if (playing) {
      speaker.stop();
      return;
    }
    if (stopLast && stopLast !== speaker.stop) stopLast();
    stopLast = speaker.stop;
    await speaker.speak(voiceId, text, voiceId, settings);
  };

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void toggle();
        }}
        aria-label={playing ? "Stop" : label}
        title={playing ? "Stop" : label}
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm outline-none transition-transform hover:scale-105 focus-visible:ring-[3px] focus-visible:ring-ring/50",
          className,
        )}
      >
        {playing ? <Pause className="size-4 fill-current" /> : <Play className="ml-0.5 size-4 fill-current" />}
      </button>
      {speaker.error && <span className="max-w-48 text-right text-[11px] text-destructive">{speaker.error}</span>}
    </span>
  );
}
