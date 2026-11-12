"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { transcribeSpeech } from "@/app/(app)/lab/actions";

/**
 * Listening done on our side: the browser only records (every modern browser can), notices when
 * the person stops talking, and our server writes down what was said (Groq Whisper, with word
 * hints from the agent). Same shape as useListener, so the Test panel can use either.
 */

const SILENCE_MS = 1200; // quiet this long after speaking = they finished
const NO_SPEECH_MS = 8000; // nothing said this long = "heard nothing"
const MAX_MS = 30_000; // one turn is at most 30 seconds
const MIN_SPEECH_MS = 250; // shorter bursts are treated as noise

/** Phrases Whisper sometimes "hears" in near-silence; never sent as the caller's words. */
const HALLUCINATIONS = /^(thank you\.?|thanks for watching\.?|you\.?|bye\.?|\.+)$/i;

function pickMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const t of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"]) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return "";
}

const ERRORS: Record<string, string> = {
  NotAllowedError: "Microphone access was blocked. Allow the microphone for this site in your browser, then try again.",
  NotFoundError: "No microphone was found.",
  NotReadableError: "The microphone is being used by another app.",
};

export function useRecorderListener(language: string, getHints: () => string[]) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  /** 0 to 1: how loud the microphone is, for a small level meter. */
  const [level, setLevel] = useState(0);

  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);
  const hintsRef = useRef(getHints);
  hintsRef.current = getHints;

  useEffect(() => {
    setSupported(typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined");
    return () => {
      cancelRef.current?.();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      void ctxRef.current?.close();
    };
  }, []);

  const getStream = async () => {
    if (streamRef.current?.active) return streamRef.current;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    streamRef.current = stream;
    return stream;
  };

  /** Listen for one turn; `onText` gets the words, `onNothing` runs if nothing (clear) was said. */
  const listen = useCallback(
    (onText: (text: string) => void, onNothing?: () => void) => {
      cancelRef.current?.();
      setError(null);
      setInterim("");
      setListening(true);
      let cancelled = false;
      let timer: ReturnType<typeof setInterval> | undefined;
      let recorder: MediaRecorder | undefined;
      cancelRef.current = () => {
        cancelled = true;
        if (timer) clearInterval(timer);
        if (recorder && recorder.state !== "inactive") recorder.stop();
        setListening(false);
        setLevel(0);
      };

      void (async () => {
        let stream: MediaStream;
        try {
          stream = await getStream();
        } catch (e) {
          setError(ERRORS[(e as Error).name] ?? "The microphone could not be started.");
          setListening(false);
          return;
        }
        if (cancelled) return;
        const ctx = ctxRef.current ?? new AudioContext();
        ctxRef.current = ctx;
        if (ctx.state === "suspended") await ctx.resume().catch(() => {});
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        source.connect(analyser);
        const data = new Float32Array(analyser.fftSize);

        const mime = pickMime();
        recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
        const chunks: Blob[] = [];
        recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);

        const started = Date.now();
        let noise = 0.01;
        let speechStart = 0;
        let speechMs = 0;
        let lastLoud = 0;
        let finished = false;

        const finish = (spoke: boolean) => {
          if (finished) return;
          finished = true;
          if (timer) clearInterval(timer);
          source.disconnect();
          setLevel(0);
          recorder!.onstop = async () => {
            setListening(false);
            if (cancelled) return;
            if (!spoke) {
              onNothing?.();
              return;
            }
            setInterim("Writing down what you said…");
            const form = new FormData();
            form.append("audio", new Blob(chunks, { type: recorder!.mimeType || mime || "audio/webm" }));
            form.append("hints", JSON.stringify(hintsRef.current().slice(0, 30)));
            form.append("language", language);
            const result = await transcribeSpeech(form).catch(() => ({ ok: false as const, message: "The recording could not be sent. Check your connection." }));
            setInterim("");
            if (cancelled) return;
            if (!result.ok) {
              setError(result.message);
              onNothing?.();
              return;
            }
            const text = result.text.trim();
            if (!text || HALLUCINATIONS.test(text)) onNothing?.();
            else onText(text);
          };
          if (recorder!.state !== "inactive") recorder!.stop();
        };

        recorder.start(250);
        timer = setInterval(() => {
          analyser.getFloatTimeDomainData(data);
          let sum = 0;
          for (const v of data) sum += v * v;
          const rms = Math.sqrt(sum / data.length);
          const now = Date.now();
          // Learn the room's background noise in the first half second, then listen above it.
          if (now - started < 500 && !speechStart) noise = Math.max(noise, rms);
          const threshold = Math.max(0.02, noise * 2.2);
          setLevel(Math.min(1, rms / (threshold * 4)));
          if (rms > threshold) {
            if (!speechStart) speechStart = now;
            lastLoud = now;
            speechMs = now - speechStart;
          }
          const spoke = speechMs >= MIN_SPEECH_MS;
          if (spoke && now - lastLoud > SILENCE_MS) finish(true);
          else if (!spoke && now - started > NO_SPEECH_MS) finish(false);
          else if (now - started > MAX_MS) finish(spoke);
        }, 50);
      })();
    },
    [language],
  );

  const stopListening = useCallback(() => cancelRef.current?.(), []);

  return { supported, listening, interim, error, level, listen, stopListening };
}
