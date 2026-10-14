"use client";

import { LANGUAGE_NAMES, VOICE_CATALOGUE, type VoiceLanguage } from "@spagai/core";
import { Info } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/i18n/client";
import { PlayButton } from "./play-button";
import { useSpeaker } from "./use-speaker";

export function VoiceLibrary({ usedBy }: { usedBy: Record<string, { id: string; name: string }[]> }) {
  const t = useT();
  const speaker = useSpeaker();
  const [customLine, setCustomLine] = useState("");

  return (
    <div className="space-y-6">
      <Alert>
        <Info />
        <span>{t("voices.mockNote")}</span>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>{t("voices.tryTitle")}</CardTitle>
          <CardDescription>{t("voices.tryIntro")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1.5">
          <Label htmlFor="custom-line" className="sr-only">{t("voices.tryTitle")}</Label>
          <Textarea
            id="custom-line"
            rows={2}
            maxLength={1000}
            value={customLine}
            placeholder={t("voices.tryPlaceholder")}
            onChange={(e) => setCustomLine(e.target.value)}
          />
        </CardContent>
      </Card>

      {speaker.error && <Alert variant="destructive">{speaker.error}</Alert>}

      {(Object.keys(LANGUAGE_NAMES) as VoiceLanguage[]).map((language) => {
        const voices = VOICE_CATALOGUE.filter((v) => v.language === language);
        if (!voices.length) return null;
        return (
          <section key={language} className="space-y-3">
            <h2 className="text-lg font-medium">{LANGUAGE_NAMES[language]}</h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {voices.map((v) => {
                const usable = v.status === "available";
                const line = customLine.trim() || v.sampleText;
                const agents = usedBy[v.id] ?? [];
                return (
                  <Card key={v.id} className={usable ? undefined : "opacity-70"}>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <CardTitle>{v.name}</CardTitle>
                          <CardDescription>{v.gender === "female" ? t("voices.female") : t("voices.male")} · {LANGUAGE_NAMES[v.language]}</CardDescription>
                        </div>
                        <Badge variant={usable ? "outline" : "warning"}>{usable ? v.provider : t("builder.voice.notConfigured")}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm italic text-muted-foreground">“{line}”</p>
                      <PlayButton
                        playing={speaker.playingKey === v.id}
                        disabled={!usable}
                        onPlay={() => void speaker.speak(v.id, line)}
                        onStop={speaker.stop}
                      />
                      <p className="text-xs text-muted-foreground">
                        {agents.length === 0
                          ? t("voices.unused")
                          : (
                            <>
                              {t("voices.usedBy")}{" "}
                              {agents.map((a, i) => (
                                <span key={a.id}>
                                  {i > 0 && ", "}
                                  <Link href={`/agents/${a.id}`} className="underline underline-offset-2">{a.name}</Link>
                                </span>
                              ))}
                            </>
                          )}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
