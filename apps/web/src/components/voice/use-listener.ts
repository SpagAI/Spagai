"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Speech to text with the browser's own speech recognition (free; Chrome, Edge and Safari).
 * Nothing is sent to Spag AI's servers by this: the browser does the listening.
 */

interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type RecognitionCtor = new () => RecognitionLike;

function getRecognition(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Browser language tags for our languages. Nigerian languages fall back to Nigerian English. */
const LANG: Record<string, string> = { "en-NG": "en-NG", pcm: "en-NG", yo: "yo-NG", ha: "ha-NG", ig: "ig-NG" };

const ERRORS: Record<string, string> = {
  "not-allowed": "Microphone access was blocked. Allow the microphone for this site in your browser, then try again.",
  "service-not-allowed": "Microphone access was blocked. Allow the microphone for this site in your browser, then try again.",
  "audio-capture": "No microphone was found.",
  network: "Speech recognition needs an internet connection.",
};

export function useListener(language: string) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<RecognitionLike | null>(null);

  useEffect(() => {
    setSupported(getRecognition() !== null);
    return () => recRef.current?.abort();
  }, []);

  /** Listen for one thing the person says; `onText` gets the final words. */
  const listen = useCallback(
    (onText: (text: string) => void) => {
      const Ctor = getRecognition();
      if (!Ctor) {
        setError("This browser cannot listen. Use Chrome or Edge, or type instead.");
        return;
      }
      recRef.current?.abort();
      const rec = new Ctor();
      rec.lang = LANG[language] ?? "en-NG";
      rec.interimResults = true;
      rec.continuous = false;
      let finalText = "";
      rec.onresult = (e) => {
        let live = "";
        for (let i = 0; i < e.results.length; i++) {
          const r = e.results[i]!;
          if (r.isFinal) finalText += r[0]!.transcript;
          else live += r[0]!.transcript;
        }
        setInterim((finalText + live).trim());
      };
      rec.onerror = (e) => {
        if (e.error !== "no-speech" && e.error !== "aborted") setError(ERRORS[e.error] ?? "The microphone stopped. Please try again.");
      };
      rec.onend = () => {
        setListening(false);
        setInterim("");
        const text = finalText.trim();
        if (text) onText(text);
      };
      setError(null);
      setListening(true);
      recRef.current = rec;
      rec.start();
    },
    [language],
  );

  const stopListening = useCallback(() => recRef.current?.stop(), []);

  return { supported, listening, interim, error, listen, stopListening };
}
