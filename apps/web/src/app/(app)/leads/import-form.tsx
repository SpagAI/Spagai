"use client";

import { Upload } from "lucide-react";
import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/i18n/client";
import { importLeads, type ImportState } from "./actions";

export function ImportForm() {
  const t = useT();
  const [state, action, pending] = useActionState<ImportState, FormData>(importLeads, { status: "idle" });
  return (
    <form action={action} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="file">{t("leads.file")}</Label>
        <Input id="file" name="file" type="file" accept=".csv,text/csv" required />
        <p className="text-xs text-muted-foreground">{t("leads.fileHelp")}</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="import-source">{t("leads.defaultSource")}</Label>
        <Input id="import-source" name="source" maxLength={120} placeholder={t("leads.sourcePlaceholder")} />
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="consent" className="mt-0.5 accent-[var(--primary)]" />
        {t("leads.defaultConsent")}
      </label>
      <Button type="submit" disabled={pending}><Upload /> {pending ? t("leads.importing") : t("leads.import")}</Button>

      {state.status === "error" && <Alert variant="destructive">{state.message}</Alert>}
      {state.status === "done" && (
        <Alert variant={state.errors.length || state.blockedColumns.length ? "warning" : "success"}>
          <p className="font-medium">
            {t("leads.importResult").replace("{created}", String(state.created)).replace("{updated}", String(state.updated))}
          </p>
          {state.duplicates > 0 && <p>{t("leads.duplicates").replace("{count}", String(state.duplicates))}</p>}
          {state.blockedColumns.length > 0 && (
            <p>{t("leads.blockedColumns")} <strong>{state.blockedColumns.join(", ")}</strong></p>
          )}
          {state.errors.length > 0 && (
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {state.errors.map((e) => <li key={`${e.row}-${e.reason}`}>{t("leads.row")} {e.row}: {e.reason}</li>)}
            </ul>
          )}
        </Alert>
      )}
    </form>
  );
}
