"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { previewVoice } from "@/app/(app)/voices/actions";

/**
 * Plays a line in one of our voices.
 * Mock voices use the browser's built-in speech (free, offline-friendly). It is a
 * stand-in: it shows timing and wording, not the final voice quality.
 */

const FEMALE_HINTS = /female|woman|zira|hazel|susan|aria|jenny|libby|sonia|ezinne|samantha|victoria|karen|moira|tessa|natasha|clara|emma|amy|joanna/i;
const MALE_HINTS = /\bmale\b|\bman\b|david|mark|george|ryan|guy|abeo|daniel|thomas|alex|fred|james|liam|brian|william|christopher/i;

/** Browser language tags to try for each of our languages, best first. */
const LANG_FALLBACKS: Record<string, string[]> = {
  "en-NG": ["en-NG", "en-GB", "en-ZA", "en"],
  pcm: ["en-NG", "en-GB", "en"],
  yo: ["yo", "en-NG", "en-GB", "en"],
  ha: ["ha", "en-NG", "en-GB", "en"],
  ig: ["ig", "en-NG", "en-GB", "en"],
};

function pickBrowserVoice(voices: SpeechSynthesisVoice[], language: string, gender: "female" | "male") {
  for (const tag of LANG_FALLBACKS[language] ?? ["en"]) {
    const matching = voices.filter((v) => v.lang.toLowerCase().replace("_", "-").startsWith(tag.toLowerCase()));
    if (!matching.length) continue;
    const hint = gender === "female" ? FEMALE_HINTS : MALE_HINTS;
    return matching.find((v) => hint.test(v.name)) ?? matching[0]!;
  }
  return voices[0];
}

function loadBrowserVoices(): Promise<SpeechSynthesisVoice[]> {
  const synth = window.speechSynthesis;
  const now = synth.getVoices();
  if (now.length) return Promise.resolve(now);
  return new Promise((resolve) => {
    const done = () => resolve(synth.getVoices());
    synth.addEventListener("voiceschanged", done, { once: true });
    setTimeout(done, 1500);
  });
}

export function useSpeaker() {
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stop = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    audioRef.current?.pause();
    setPlayingKey(null);
  }, []);

  useEffect(() => stop, [stop]);

  /** Speak `text` in `voiceId`. `key` identifies the button, so it can show "playing". */
  const speak = useCallback(
    async (voiceId: string, text: string, key = voiceId): Promise<void> => {
      stop();
      setError(null);
      setPlayingKey(key);
      const result = await previewVoice(voiceId, text);
      if (result.kind === "error") {
        setError(result.message);
        setPlayingKey(null);
        return;
      }
      await new Promise<void>((resolve) => {
        const finish = () => {
          setPlayingKey((k) => (k === key ? null : k));
          resolve();
        };
        if (result.kind === "audio") {
          const audio = new Audio(result.src);
          audioRef.current = audio;
          audio.onended = finish;
          audio.onerror = finish;
          void audio.play().catch(finish);
          return;
        }
        if (!("speechSynthesis" in window)) {
          setError("This browser cannot play voices.");
          finish();
          return;
        }
        void loadBrowserVoices().then((voices) => {
          const utterance = new SpeechSynthesisUtterance(result.text);
          const browserVoice = pickBrowserVoice(voices, result.language, result.gender);
          if (browserVoice) utterance.voice = browserVoice;
          // Small pitch differences so each mock voice sounds a little different.
          const n = Number(/\d+$/.exec(result.providerVoiceId)?.[0] ?? 1);
          utterance.pitch = (result.gender === "female" ? 1.1 : 0.85) + (n - 1) * 0.08;
          utterance.rate = 0.95;
          utterance.onend = finish;
          utterance.onerror = finish;
          window.speechSynthesis.speak(utterance);
        });
      });
    },
    [stop],
  );

  return { speak, stop, playingKey, error };
}
