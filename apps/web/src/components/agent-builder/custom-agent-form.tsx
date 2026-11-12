"use client";

import { DEFAULT_VOICE_SETTINGS, LANGUAGE_NAMES, MAX_BLOCK_CHARS, renderVariables, VOICE_PROVIDERS, type Voice, type VoiceLanguage, type VoiceSettings, voiceSettingsSchema } from "@spagai/core";
import { History, Loader2, Settings2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { createCustomAgent } from "@/app/(app)/agents/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PlayVoiceButton } from "@/components/voice/play-voice-button";
import { VoiceSettingsControls } from "@/components/voice/voice-settings";
import { defaultFirstMessage } from "@/lib/custom-agent";

const PROMPT_HINT = `Write the instructions in your own words, or paste a prompt you already have. For example:

You are Kemi, a friendly assistant for Lagos Homes. You call people who asked about our flats in Lekki.
- Confirm you are speaking to the right person.
- Answer questions about price, location and payment plans.
- If they are interested, book a viewing and confirm the date and time.
- Keep answers short and polite.`;

/** "Custom": set everything yourself. Nothing is written for you except the standard safety rules. */
export function CustomAgentForm({ voices, company, storageKey }: { voices: Voice[]; company: string; storageKey: string }) {
  const [name, setName] = useState("");
  const [business, setBusiness] = useState(company);
  const [direction, setDirection] = useState<"outbound" | "inbound">("outbound");
  const [language, setLanguage] = useState<VoiceLanguage>("en-NG");
  const forLanguage = voices.filter((v) => v.language === language);
  const [voiceId, setVoiceId] = useState<string>(forLanguage[0]?.id ?? "");
  const [firstMessage, setFirstMessage] = useState(defaultFirstMessage("outbound"));
  const [firstEdited, setFirstEdited] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [settings, setSettings] = useState<VoiceSettings>(DEFAULT_VOICE_SETTINGS);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  /** When the form was brought back from this browser's saved copy. */
  const [restored, setRestored] = useState(false);
  const [ready, setReady] = useState(false);

  // Keep what is typed in this browser, so leaving by mistake loses nothing.
  const snapshot = { name, business, direction, language, voiceId, firstMessage, firstEdited, prompt, settings };
  const write = (value: typeof snapshot | null) => {
    try {
      if (value) localStorage.setItem(storageKey, JSON.stringify({ ...value, at: Date.now() }));
      else localStorage.removeItem(storageKey);
    } catch {
      // Private browsing or storage blocked: the form still works, it just is not kept.
    }
  };
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      const d = raw ? (JSON.parse(raw) as Partial<typeof snapshot>) : null;
      if (d && (d.prompt?.trim() || d.name?.trim())) {
        if (typeof d.name === "string") setName(d.name);
        if (typeof d.business === "string") setBusiness(d.business);
        if (d.direction === "inbound" || d.direction === "outbound") setDirection(d.direction);
        if (typeof d.language === "string" && d.language in LANGUAGE_NAMES) setLanguage(d.language as VoiceLanguage);
        if (typeof d.voiceId === "string" && (d.voiceId === "" || voices.some((v) => v.id === d.voiceId))) setVoiceId(d.voiceId);
        if (typeof d.firstMessage === "string") setFirstMessage(d.firstMessage);
        if (typeof d.firstEdited === "boolean") setFirstEdited(d.firstEdited);
        if (typeof d.prompt === "string") setPrompt(d.prompt);
        const vs = voiceSettingsSchema.safeParse(d.settings);
        if (vs.success) setSettings(vs.data);
        setRestored(true);
      }
    } catch {
      // Nothing usable saved.
    }
    setReady(true);
    // Only on first load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const snapshotJson = JSON.stringify(snapshot);
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      const s = JSON.parse(snapshotJson) as typeof snapshot;
      write(s.prompt.trim() || s.name.trim() ? s : null);
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshotJson, ready]);

  const startFresh = () => {
    write(null);
    setName("");
    setBusiness(company);
    setDirection("outbound");
    setLanguage("en-NG");
    setVoiceId(voices.find((v) => v.language === "en-NG")?.id ?? "");
    setFirstMessage(defaultFirstMessage("outbound"));
    setFirstEdited(false);
    setPrompt("");
    setSettings(DEFAULT_VOICE_SETTINGS);
    setRestored(false);
  };

  const voice = forLanguage.find((v) => v.id === voiceId);
  const spoken = renderVariables(firstMessage, { agent_name: name || "your agent", company_name: business || company, lead_name: "Chinedu" }).replace(/\{\{\s*\w+\s*\}\}/g, "");

  const changeLanguage = (next: VoiceLanguage) => {
    setLanguage(next);
    setVoiceId(voices.find((v) => v.language === next)?.id ?? "");
  };
  const changeDirection = (next: "outbound" | "inbound") => {
    setDirection(next);
    if (!firstEdited) setFirstMessage(defaultFirstMessage(next));
  };

  const submit = () => {
    setErrors([]);
    startTransition(async () => {
      const kept = snapshot;
      // The agent is being created: this browser's copy is no longer needed (put back if it fails).
      write(null);
      const result = await createCustomAgent({ name, company: business, direction, language, voiceId: voiceId || null, firstMessage, prompt, voiceSettings: settings });
      if (result && !result.ok) {
        setErrors(result.errors);
        write(kept);
      }
    });
  };

  const real = forLanguage.filter((v) => v.provider === "fish_audio");
  const demo = forLanguage.filter((v) => v.provider !== "fish_audio");

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {restored && (
        <Alert>
          <History className="size-4" />
          <span>
            We brought back what you were writing. Nothing was lost.{" "}
            <button type="button" onClick={startFresh} className="font-medium underline underline-offset-2">Start fresh</button>
          </span>
        </Alert>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5"><Label htmlFor="c-name">Agent name</Label><Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} placeholder="e.g. Kemi" /></div>
        <div className="space-y-1.5"><Label htmlFor="c-company">Business name</Label><Input id="c-company" value={business} onChange={(e) => setBusiness(e.target.value)} required maxLength={120} /></div>
        <div className="space-y-1.5">
          <Label htmlFor="c-direction">Calls</Label>
          <Select id="c-direction" value={direction} onChange={(e) => changeDirection(e.target.value as "outbound" | "inbound")}>
            <option value="outbound">It calls customers (outbound)</option>
            <option value="inbound">It answers calls (inbound)</option>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="c-language">Language</Label>
          <Select id="c-language" value={language} onChange={(e) => changeLanguage(e.target.value as VoiceLanguage)}>
            {Object.entries(LANGUAGE_NAMES).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="c-voice">Voice</Label>
        <div className="flex items-center gap-2">
          <Select id="c-voice" value={voiceId} onChange={(e) => setVoiceId(e.target.value)} className="max-w-md">
            {real.length > 0 && (
              <optgroup label={`Real voices (${VOICE_PROVIDERS.fish_audio})`}>
                {real.map((v) => <option key={v.id} value={v.id}>{v.name} · {v.gender === "female" ? "Female" : "Male"} · {v.category}</option>)}
              </optgroup>
            )}
            {demo.length > 0 && (
              <optgroup label="Demo voices (browser speech)">
                {demo.map((v) => <option key={v.id} value={v.id}>{v.name} · {v.gender === "female" ? "Female" : "Male"} · {v.category}</option>)}
              </optgroup>
            )}
            <option value="">Choose later</option>
          </Select>
          {voice && spoken && <PlayVoiceButton voiceId={voice.id} text={spoken} settings={settings} label={`Hear ${voice.name} say the first message`} />}
        </div>
        <p className="text-xs text-muted-foreground">{voice ? `${voice.description} Press play to hear it say your first message.` : "You can choose a voice later in the Voice tab."}</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="c-first">First message</Label>
        <Textarea id="c-first" rows={2} maxLength={1000} value={firstMessage} onChange={(e) => { setFirstMessage(e.target.value); setFirstEdited(true); }} />
        <p className="text-xs text-muted-foreground">What the agent says as soon as the call starts. You can use {"{{agent_name}}"}, {"{{company_name}}"} and {"{{lead_name}}"}.</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="c-prompt">Prompt</Label>
        <Textarea id="c-prompt" rows={14} maxLength={MAX_BLOCK_CHARS} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={PROMPT_HINT} className="font-mono text-sm" />
        <div className="flex justify-between gap-3 text-xs text-muted-foreground">
          <span>Saved exactly as you write it, and kept in this browser as you type. Any other {"{{name}}"} you use becomes a value you fill per call or from your lead list.</span>
          <span className="shrink-0 tabular-nums">{prompt.length.toLocaleString("en-NG")} / {MAX_BLOCK_CHARS.toLocaleString("en-NG")}</span>
        </div>
      </div>

      <VoiceSettingsControls value={settings} onChange={setSettings} voiceId={voice?.id} sampleText={spoken} realVoice={voice?.provider === "fish_audio"} />

      <Alert>
        <Settings2 className="size-4" /> The standard safety rules (saying it is an AI, calling hours, opting out, keeping data safe) are added to every agent and cannot be removed. Nothing else is added or changed.
      </Alert>

      {errors.length > 0 && <Alert variant="destructive">{errors.join(" ")}</Alert>}

      <Button type="submit" disabled={pending}>{pending ? <Loader2 className="animate-spin" /> : null} Create custom agent</Button>
    </form>
  );
}
