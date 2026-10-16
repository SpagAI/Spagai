"use client";

import { Check, Copy, Eye, EyeOff, KeyRound, Loader2, Plus, TriangleAlert } from "lucide-react";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { ConfirmButton } from "@/components/confirm-button";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createApiKey, deleteApiKey, revealApiKey, type CreateKeyState } from "./actions";

const MASK = "•".repeat(28);

function CopyButton({ value, label = "Copy" }: { value: string | null; label?: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={!value}
      onClick={async () => {
        if (!value) return;
        await navigator.clipboard.writeText(value);
        setCopied(true);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), 1800);
      }}
    >
      {copied ? <Check /> : <Copy />} {copied ? "Copied" : label}
    </Button>
  );
}

export function CreateKey() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<CreateKeyState, FormData>(createApiKey, { status: "idle" });
  useEffect(() => { if (state.status === "created") formRef.current?.reset(); }, [state]);
  return (
    <div className="space-y-4">
      <form ref={formRef} action={action} className="flex flex-col gap-2 sm:flex-row">
        <Input name="name" required minLength={2} maxLength={60} placeholder="Key name, e.g. Website lead form" aria-label="Key name" className="sm:max-w-sm" />
        <Button type="submit" disabled={pending}>{pending ? <Loader2 className="animate-spin" /> : <Plus />} Create key</Button>
      </form>
      {state.status === "error" && <FormMessage state={state} />}
      {state.status === "created" && (
        <div role="status" className="space-y-3 rounded-lg border border-primary/40 bg-primary/5 p-4">
          <p className="flex items-center gap-2 text-sm font-medium"><KeyRound className="size-4 text-primary" /> “{state.name}” is ready. Copy it now and keep it somewhere safe.</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="min-w-0 flex-1 truncate rounded-md border bg-background px-3 py-2 font-mono text-sm">{state.key}</code>
            <CopyButton value={state.key} label="Copy key" />
          </div>
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground"><TriangleAlert className="mt-0.5 size-3.5 shrink-0" /> Anyone with this key can use your workspace. Never put it in a public website or app.</p>
        </div>
      )}
    </div>
  );
}

export function KeyRow({ id, name, prefix, created, lastUsed, createdBy, canManage }: { id: string; name: string; prefix: string; created: string; lastUsed: string; createdBy: string; canManage: boolean }) {
  const [key, setKey] = useState<string | null>(null);
  const [shown, setShown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, start] = useTransition();

  const load = () => start(async () => {
    const r = await revealApiKey(id);
    if ("key" in r) { setKey(r.key); setShown(true); setError(null); } else setError(r.error);
  });

  return (
    <tr className="border-b last:border-0">
      <td className="py-3 pr-3">
        <p className="font-medium">{name}</p>
        <p className="text-xs text-muted-foreground">by {createdBy}</p>
      </td>
      <td className="pr-3">
        <div className="flex items-center gap-1.5">
          <code className="max-w-[22rem] truncate rounded bg-muted px-2 py-1 font-mono text-xs">{shown && key ? key : `${prefix}${MASK}`}</code>
          {canManage && (
            <Button type="button" variant="ghost" size="icon" className="size-7" aria-label={shown ? "Hide key" : "Show key"} disabled={loading} onClick={() => (shown ? setShown(false) : key ? setShown(true) : load())}>
              {loading ? <Loader2 className="animate-spin" /> : shown ? <EyeOff /> : <Eye />}
            </Button>
          )}
        </div>
        {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      </td>
      <td className="whitespace-nowrap pr-3 text-muted-foreground">{created}</td>
      <td className="whitespace-nowrap pr-3 text-muted-foreground">{lastUsed}</td>
      <td className="text-right">
        {canManage && (
          <div className="flex items-center justify-end gap-1">
            <CopyKey id={id} cached={key} onLoaded={setKey} />
            <form action={deleteApiKey}>
              <input type="hidden" name="id" value={id} />
              <ConfirmButton variant="ghost" size="sm" className="text-destructive hover:text-destructive" confirm={`Delete “${name}”? Anything using this key will stop working straight away.`} pendingText="Deleting…">Delete</ConfirmButton>
            </form>
          </div>
        )}
      </td>
    </tr>
  );
}

function CopyKey({ id, cached, onLoaded }: { id: string; cached: string | null; onLoaded: (k: string) => void }) {
  const [copied, setCopied] = useState(false);
  const [busy, start] = useTransition();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={busy}
      onClick={() => start(async () => {
        let key = cached;
        if (!key) { const r = await revealApiKey(id); if ("key" in r) { key = r.key; onLoaded(r.key); } }
        if (!key) return;
        await navigator.clipboard.writeText(key);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      })}
    >
      {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy"}
    </Button>
  );
}
