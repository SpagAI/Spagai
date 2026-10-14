"use client";

import { Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n/client";

export function PlayButton({
  playing,
  disabled,
  onPlay,
  onStop,
  size = "sm",
}: {
  playing: boolean;
  disabled?: boolean;
  onPlay: () => void;
  onStop: () => void;
  size?: "sm" | "icon";
}) {
  const t = useT();
  const label = playing ? t("voices.stop") : t("voices.play");
  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      disabled={disabled}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        if (playing) onStop();
        else onPlay();
      }}
    >
      {playing ? <Square /> : <Play />}
      {size !== "icon" && label}
    </Button>
  );
}
