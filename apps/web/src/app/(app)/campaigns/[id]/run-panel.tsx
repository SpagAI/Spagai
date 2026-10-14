"use client";

import { formatNaira } from "@spagai/core";
import { PhoneOutgoing } from "lucide-react";
import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useT } from "@/i18n/client";
import { runBatch, type BatchState } from "../actions";

export function RunPanel({ campaignId, initialTime, mock }: { campaignId: string; initialTime: string; mock: boolean }) {
  const t = useT();
  const [state, action, pending] = useActionState<BatchState, FormData>(runBatch, { status: "idle" });
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="campaignId" value={campaignId} />
      <div className="grid gap-3 sm:grid-cols-[8rem_1fr_auto] sm:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="limit">{t("campaigns.howMany")}</Label>
          <Select id="limit" name="limit" defaultValue="10">
            {[5, 10, 25, 50].map((n) => <option key={n} value={n}>{n}</option>)}
          </Select>
        </div>
        {mock && (
          <div className="space-y-1.5">
            <Label htmlFor="pretendTime">{t("campaigns.pretendTime")}</Label>
            <Input id="pretendTime" name="pretendTime" type="datetime-local" defaultValue={initialTime} />
          </div>
        )}
        <Button type="submit" disabled={pending}><PhoneOutgoing /> {pending ? t("campaigns.running") : t("campaigns.run")}</Button>
      </div>
      {mock && <p className="text-xs text-muted-foreground">{t("campaigns.pretendHelp")}</p>}

      {state.status === "error" && <Alert variant="destructive">{state.message}</Alert>}
      {state.status === "done" && (
        <Alert variant={state.summary.stoppedBecause ? "warning" : "success"}>
          <p className="font-medium">
            {t("campaigns.batchResult")
              .replace("{completed}", String(state.summary.completed))
              .replace("{noAnswer}", String(state.summary.noAnswer))
              .replace("{blocked}", String(state.summary.blocked))}
          </p>
          {state.summary.chargedKobo > 0 && <p>{t("campaigns.charged")} {formatNaira(state.summary.chargedKobo)}</p>}
          {state.summary.failed > 0 && <p>{t("campaigns.batchFailed").replace("{count}", String(state.summary.failed))}</p>}
          {state.summary.stoppedBecause && <p>{t("campaigns.stoppedBecause")} {state.summary.stoppedBecause}</p>}
          {state.summary.finished && <p>{t("campaigns.finished")}</p>}
        </Alert>
      )}
    </form>
  );
}
