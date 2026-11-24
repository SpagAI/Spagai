"use client";

import { LANGUAGE_NAMES, type VoiceLanguage } from "@spagai/core";
import { Check, Loader2, TriangleAlert } from "lucide-react";
import { useRef, useState } from "react";
import { rewriteFirstMessage } from "@/app/(app)/agents/actions";

type Status =
  | { kind: "idle" }
  | { kind: "working"; language: string }
  | { kind: "done"; language: string; text: string; usedAi: boolean }
  | { kind: "error"; message: string };

const languageName = (code: string) => LANGUAGE_NAMES[code as VoiceLanguage] ?? code;

/**
 * When an agent's Language changes, put its first message in that language too (D174): our standard
 * opening lines switch instantly, the person's own wording is rewritten by the AI brain.
 */
export function useFirstMessageLanguage() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const request = useRef(0);

  /**
   * `current` reads the first message as it is now: if the person edited it while the rewrite was
   * on its way, their edit wins and the rewrite is not applied.
   */
  const rewrite = async (text: string, language: string, apply: (text: string) => void, current: () => string) => {
    if (!text.trim()) return;
    const id = ++request.current;
    setStatus({ kind: "working", language });
    const result = await rewriteFirstMessage({ text, language }).catch(() => ({ ok: false as const, message: "The first message could not be rewritten just now." }));
    if (id !== request.current) return; // a newer language change replaced this one
    if (!result.ok) return setStatus({ kind: "error", message: result.message });
    if (current().trim() !== text.trim()) return setStatus({ kind: "idle" });
    apply(result.text);
    setStatus({ kind: "done", language, text: result.text, usedAi: result.usedAi });
  };

  return { status, rewrite };
}

export function FirstMessageLanguageNote({ status }: { status: ReturnType<typeof useFirstMessageLanguage>["status"] }) {
  if (status.kind === "idle") return null;
  if (status.kind === "working") {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
        <Loader2 className="size-3.5 animate-spin" /> Writing the first message in {languageName(status.language)}…
      </p>
    );
  }
  if (status.kind === "error") {
    return (
      <p className="flex items-start gap-1.5 text-xs text-destructive" role="status">
        <TriangleAlert className="mt-0.5 size-3.5 shrink-0" /> The first message was not changed: {status.message} You can change it yourself on the First message tab.
      </p>
    );
  }
  return (
    <p className="flex items-start gap-1.5 text-xs text-muted-foreground" role="status">
      <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
      <span>
        First message is now in {languageName(status.language)}: <span className="text-foreground">“{status.text}”</span>
        {status.usedAi ? " Written by the AI from your own line, so give it a quick read." : ""}
      </span>
    </p>
  );
}
