"use client";

import { CircleCheck, Loader2, Plug, Send } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import { ConfirmButton } from "@/components/confirm-button";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { IntegrationInfo } from "@/lib/integrations";
import { WEBHOOK_EVENTS } from "@/lib/integrations";
import { cn } from "@/lib/utils";
import { connectIntegration, disconnectIntegration, sendTestEvent, type ConnectState } from "./actions";

export function IntegrationCard({ info, connected, canManage }: { info: IntegrationInfo; connected: { detail: string; since: string } | null; canManage: boolean }) {
  const [open, setOpen] = useState(false);
  const [test, setTest] = useState<string | null>(null);
  const [testing, startTest] = useTransition();
  const [state, action, pending] = useActionState<ConnectState, FormData>(async (prev, form) => {
    // A short pause, like a real sign-in window.
    if (!info.field) await new Promise((r) => setTimeout(r, 900));
    const result = await connectIntegration(prev, form);
    if (result.status === "ok") setOpen(false);
    return result;
  }, { status: "idle" });

  return (
    <li className={cn("flex flex-col gap-4 rounded-xl border bg-card p-5 transition-colors", connected && "border-primary/40")}>
      <div className="flex items-start gap-3">
        <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl text-base font-bold shadow-sm", info.tile)} aria-hidden>
          {info.id === "webhook" ? "{ }" : info.name.replace(/\.com$/, "").slice(0, info.id === "n8n" ? 3 : 1)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold">{info.name}</p>
            {connected ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400"><CircleCheck className="size-3.5" /> Connected</span>
            ) : (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{info.category}</span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{info.description}</p>
        </div>
      </div>

      {connected && (
        <div className="rounded-lg bg-muted/60 px-3 py-2 text-xs">
          <p className="truncate font-medium" title={connected.detail}>{connected.detail}</p>
          <p className="text-muted-foreground">Connected {connected.since}</p>
          {info.id === "webhook" && <p className="mt-1 text-muted-foreground">Events: {WEBHOOK_EVENTS.join(", ")}</p>}
        </div>
      )}

      {open && !connected && (
        <form action={action} className="space-y-2">
          <input type="hidden" name="provider" value={info.id} />
          {info.field ? (
            <>
              <label htmlFor={`f-${info.id}`} className="text-xs font-medium">{info.field.label}</label>
              <Input id={`f-${info.id}`} name="detail" placeholder={info.field.placeholder} autoFocus required />
            </>
          ) : (
            <p className="text-xs text-muted-foreground">You&apos;ll be asked to sign in to {info.name} and allow Spag AI to {info.category === "Calendar" ? "see your free times and add events" : info.category === "CRM" ? "read and update contacts and deals" : "run your Zaps"}.</p>
          )}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={pending}>{pending ? <><Loader2 className="animate-spin" /> {info.field ? "Checking…" : `Signing in to ${info.name}…`}</> : info.field ? "Save and connect" : `Continue with ${info.name}`}</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
          </div>
        </form>
      )}
      {state.status === "error" && <FormMessage state={state} />}
      {test && <p className="text-xs text-emerald-700 dark:text-emerald-400">{test}</p>}

      <div className="mt-auto flex items-center gap-2 border-t pt-4">
        {connected ? (
          <>
            {(info.category === "Automation" || info.id === "webhook" || info.id === "slack") && (
              <Button type="button" variant="outline" size="sm" disabled={!canManage || testing} onClick={() => startTest(async () => setTest((await sendTestEvent(info.id)).message))}>
                {testing ? <Loader2 className="animate-spin" /> : <Send />} Send test
              </Button>
            )}
            {canManage && (
              <form action={disconnectIntegration} className="ml-auto">
                <input type="hidden" name="provider" value={info.id} />
                <ConfirmButton variant="ghost" size="sm" className="text-destructive hover:text-destructive" confirm={`Disconnect ${info.name}? Nothing more will be sent to it.`} pendingText="Disconnecting…">Disconnect</ConfirmButton>
              </form>
            )}
          </>
        ) : (
          !open && <Button type="button" size="sm" onClick={() => setOpen(true)} disabled={!canManage}><Plug /> Connect</Button>
        )}
      </div>
    </li>
  );
}
