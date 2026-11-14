"use client";

import { ArrowLeft, Check, ChevronDown, Copy, Eye, KeyRound, Loader2, Plus, RefreshCw, Send, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { CONTEXT_KEYS, PARAM_TYPES, type ContextKey, type ParamType, type ToolInput, type ToolParam } from "@/lib/custom-tools";
import { cn } from "@/lib/utils";
import { deleteTool, revealSigningSecret, rotateSigningSecret, saveTool, sendTestCall } from "./actions";

export interface RunRow {
  id: string;
  source: string;
  ok: boolean;
  status: number | null;
  durationMs: number;
  response: string;
  request: unknown;
  createdAt: string;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/^(\d)/, "t_$1").slice(0, 40);

const EXAMPLE: Record<ParamType, string> = {
  text: "Ngozi Adeyemi", number: "2", boolean: "true", date: "2026-11-20", time: "10:00", email: "ngozi@example.com", phone: "08031234567", choice: "",
};

const SOURCE: Record<string, string> = { test: "Test", talk: "Test your agent", call: "Call" };

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border p-4 sm:p-5">
      <div>
        <h2 className="font-medium">{title}</h2>
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function ToolForm({ id, initial, runs = [], starterLabel }: { id: string | null; initial: ToolInput; runs?: RunRow[]; starterLabel?: string }) {
  const router = useRouter();
  const [t, setT] = useState<ToolInput>(initial);
  const [nameTouched, setNameTouched] = useState(Boolean(initial.name));
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [saving, startSave] = useTransition();
  const savedSecrets = new Set(initial.headers.filter((h) => h.secret).map((h) => h.name.toLowerCase()));

  const set = (patch: Partial<ToolInput>) => { setT((x) => ({ ...x, ...patch })); setSaved(false); };
  const setParam = (i: number, patch: Partial<ToolParam>) => set({ parameters: t.parameters.map((p, j) => (j === i ? { ...p, ...patch } : p)) });
  const setHeader = (i: number, patch: Partial<ToolInput["headers"][number]>) => set({ headers: t.headers.map((h, j) => (j === i ? { ...h, ...patch } : h)) });

  const save = () =>
    startSave(async () => {
      setErrors([]);
      const r = await saveTool(id, t);
      if (!r.ok) { setErrors(r.errors); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
      setSaved(true);
      if (!id) router.replace(`/tools/${r.id}`);
      else router.refresh();
    });

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Link href="/tools" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Tools</Link>
          <h1 className="truncate text-2xl font-semibold tracking-tight">{id ? t.label || "Tool" : starterLabel ? `New tool: ${starterLabel}` : "New tool"}</h1>
        </div>
        <div className="flex items-center gap-2">
          {saved && <span className="flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400"><Check className="size-4" /> Saved</span>}
          {id && (
            <Button variant="ghost" size="sm" className="text-destructive" onClick={async () => {
              if (!window.confirm("Delete this tool? Agents using it will stop using it.")) return;
              await deleteTool(id);
              router.replace("/tools");
            }}><Trash2 /> Delete</Button>
          )}
          <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : null} {id ? "Save" : "Create tool"}</Button>
        </div>
      </div>

      {errors.length > 0 && (
        <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <ul className="list-inside list-disc space-y-0.5">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <Section title="What it does">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Label" hint="What you see in the studio.">
                <Input value={t.label} maxLength={60} placeholder="Create CRM lead" onChange={(e) => set({ label: e.target.value, ...(nameTouched ? {} : { name: slug(e.target.value) }) })} />
              </Field>
              <Field label="Name the AI uses" hint="Lowercase letters, numbers and underscores.">
                <Input value={t.name} maxLength={40} placeholder="create_crm_lead" className="font-mono" onChange={(e) => { setNameTouched(true); set({ name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") }); }} />
              </Field>
            </div>
            <Field label="When should the agent use it?" hint="Be specific: the agent reads this to decide when to use the tool and what to collect first.">
              <Textarea rows={3} maxLength={1000} value={t.description} placeholder="Use once the caller has given their name and phone number and wants a call back." onChange={(e) => set({ description: e.target.value })} />
            </Field>
          </Section>

          <Section title="Details the agent collects" hint="The agent asks for these during the call and sends them to your webhook.">
            {t.parameters.length === 0 && <p className="text-sm text-muted-foreground">No details yet. A tool can also run with none (e.g. “notify the team”).</p>}
            <div className="space-y-2">
              {t.parameters.map((p, i) => (
                <div key={i} className="space-y-2 rounded-lg bg-muted/40 p-3">
                  <div className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[minmax(0,1fr)_150px_auto_auto]">
                    <Input aria-label="Detail name" value={p.name} placeholder="full_name" className="font-mono" onChange={(e) => setParam(i, { name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })} />
                    <Select aria-label="Type" value={p.type} className="order-3 col-span-2 sm:order-none sm:col-span-1" onChange={(e) => setParam(i, { type: e.target.value as ParamType })}>
                      {Object.entries(PARAM_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </Select>
                    <label className="order-4 flex items-center gap-2 text-sm sm:order-none">
                      <Switch checked={p.required} onCheckedChange={(v) => setParam(i, { required: v })} aria-label="Required" /> Required
                    </label>
                    <Button variant="ghost" size="icon" aria-label="Remove detail" onClick={() => set({ parameters: t.parameters.filter((_, j) => j !== i) })}><X /></Button>
                  </div>
                  <Input aria-label="Description" value={p.description} maxLength={300} placeholder="What this is, e.g. The caller's full name" onChange={(e) => setParam(i, { description: e.target.value })} />
                  {p.type === "choice" && (
                    <Input aria-label="Choices" value={(p.options ?? []).join(", ")} placeholder="Choices, separated by commas: high, medium, low" onChange={(e) => setParam(i, { options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
                  )}
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" disabled={t.parameters.length >= 20} onClick={() => set({ parameters: [...t.parameters, { name: "", type: "text", required: true, description: "" }] })}><Plus /> Add a detail</Button>
          </Section>

          <Section title="Where to send it" hint="Paste the webhook address from Zapier, Make, n8n or your own system.">
            <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-2">
              <Select aria-label="Method" value={t.method} onChange={(e) => set({ method: e.target.value as ToolInput["method"] })}>
                {["POST", "GET", "PUT", "PATCH"].map((m) => <option key={m}>{m}</option>)}
              </Select>
              <Input aria-label="Webhook address" value={t.url} placeholder="https://hooks.zapier.com/hooks/catch/…" className="font-mono" onChange={(e) => set({ url: e.target.value.trim() })} />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Headers <span className="font-normal text-muted-foreground">(optional, e.g. an API key)</span></p>
              {t.headers.map((h, i) => (
                <div key={i} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:grid-cols-[180px_minmax(0,1fr)_auto_auto]">
                  <Input aria-label="Header name" value={h.name} placeholder="Authorization" className="font-mono" onChange={(e) => setHeader(i, { name: e.target.value.replace(/[^A-Za-z0-9-]/g, "") })} />
                  <Input
                    aria-label="Header value"
                    type={h.secret ? "password" : "text"}
                    autoComplete="off"
                    value={h.value}
                    placeholder={h.secret && savedSecrets.has(h.name.toLowerCase()) ? "Saved (leave empty to keep)" : "Value"}
                    className="order-3 col-span-2 font-mono sm:order-none sm:col-span-1"
                    onChange={(e) => setHeader(i, { value: e.target.value })}
                  />
                  <label className="order-4 flex items-center gap-2 text-sm sm:order-none" title="Secret values are encrypted and never shown again">
                    <Switch checked={h.secret} onCheckedChange={(v) => setHeader(i, { secret: v })} aria-label="Secret" /> <KeyRound className="size-3.5" /> Secret
                  </label>
                  <Button variant="ghost" size="icon" aria-label="Remove header" onClick={() => set({ headers: t.headers.filter((_, j) => j !== i) })}><X /></Button>
                </div>
              ))}
              <Button variant="outline" size="sm" disabled={t.headers.length >= 10} onClick={() => set({ headers: [...t.headers, { name: "", value: "", secret: true }] })}><Plus /> Add a header</Button>
            </div>
          </Section>

          <Section title="Also send" hint="Facts about the call sent with every request, under “context”.">
            <div className="grid gap-2 sm:grid-cols-2">
              {(Object.keys(CONTEXT_KEYS) as ContextKey[]).map((k) => (
                <label key={k} className="flex items-center gap-2 text-sm">
                  <Switch checked={t.sendContext[k]} onCheckedChange={(v) => set({ sendContext: { ...t.sendContext, [k]: v } })} /> {CONTEXT_KEYS[k]}
                </label>
              ))}
            </div>
          </Section>

          <Section title="While it runs">
            <div className="grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)]">
              <Field label="Wait at most">
                <Select value={t.timeoutMs} onChange={(e) => set({ timeoutMs: Number(e.target.value) })}>
                  {[3000, 5000, 10000, 15000, 20000].map((ms) => <option key={ms} value={ms}>{ms / 1000} seconds</option>)}
                </Select>
              </Field>
              <Field label="What the agent says while waiting (optional)">
                <Input value={t.waitMessage} maxLength={200} placeholder="One moment while I book that for you." onChange={(e) => set({ waitMessage: e.target.value })} />
              </Field>
            </div>
          </Section>

          {id && <SigningSecret id={id} />}
        </div>

        <aside className="space-y-5 lg:sticky lg:top-4 lg:h-fit">
          {id ? <TestBox id={id} params={initial.parameters} dirty={JSON.stringify(t) !== JSON.stringify(initial)} /> : (
            <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">Create the tool first, then you can send a test to your webhook and see exactly what it receives.</div>
          )}
          <Preview t={t} />
        </aside>
      </div>

      {id && <RunLog runs={runs} />}
    </div>
  );
}

/** What the webhook will receive, live as you edit. */
function Preview({ t }: { t: ToolInput }) {
  const args = Object.fromEntries(t.parameters.filter((p) => p.name).map((p) => [p.name, p.type === "choice" ? p.options?.[0] ?? "" : p.type === "number" ? 2 : p.type === "boolean" ? true : EXAMPLE[p.type]]));
  const context: Record<string, unknown> = {};
  if (t.sendContext.agent) context.agent = { id: "…", name: "Zara" };
  if (t.sendContext.call) context.call_id = "…";
  if (t.sendContext.caller) context.phone = "08031234567";
  if (t.sendContext.lead) context.lead_name = "Ngozi";
  if (t.sendContext.time) context.time = "2026-11-14T10:00:00.000Z";
  const body = t.method === "GET" ? null : { tool: t.name || "tool_name", arguments: args, context, test: false };
  return (
    <details className="rounded-xl border p-4" open>
      <summary className="cursor-pointer text-sm font-medium">What your webhook receives</summary>
      <p className="mt-2 text-xs text-muted-foreground">{t.method === "GET" ? "The details are added to the web address." : "Sent as JSON, with an X-Spag-Signature header."}</p>
      {body && <pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-muted p-3 text-xs">{JSON.stringify(body, null, 2)}</pre>}
    </details>
  );
}

function TestBox({ id, params, dirty }: { id: string; params: ToolParam[]; dirty: boolean }) {
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(params.map((p) => [p.name, p.type === "choice" ? p.options?.[0] ?? "" : EXAMPLE[p.type]])));
  const [result, setResult] = useState<Awaited<ReturnType<typeof sendTestCall>> | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="space-y-3 rounded-xl border p-4">
      <div>
        <h2 className="font-medium">Send a test</h2>
        <p className="text-xs text-muted-foreground">Calls your webhook now with these example details, marked <code>&quot;test&quot;: true</code>.</p>
      </div>
      {params.map((p) => (
        <Field key={p.name} label={p.name}>
          <Input value={values[p.name] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [p.name]: e.target.value }))} className="h-8 text-sm" />
        </Field>
      ))}
      {dirty && <p className="text-xs text-amber-600 dark:text-amber-400">You have unsaved changes; the test uses the saved version.</p>}
      <Button className="w-full" variant="outline" disabled={pending} onClick={() => start(async () => { setResult(await sendTestCall(id, values)); router.refresh(); })}>
        {pending ? <Loader2 className="animate-spin" /> : <Send />} Send test
      </Button>
      {result && (!("request" in result) ? <p className="text-sm text-destructive">{result.error}</p> : (
        <div className="space-y-2 text-sm">
          <p className={cn("font-medium", result.ok ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>
            {result.ok ? "It worked" : "It did not work"}{result.status ? ` (${result.status})` : ""} · {result.durationMs} ms
          </p>
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-muted p-2 text-xs">{result.response}</pre>
          <details>
            <summary className="cursor-pointer text-xs text-muted-foreground">What was sent</summary>
            <pre className="mt-1 max-h-60 overflow-auto rounded-lg bg-muted p-2 text-xs">{JSON.stringify(result.request, null, 2)}</pre>
          </details>
        </div>
      ))}
    </div>
  );
}

function SigningSecret({ id }: { id: string }) {
  const [secret, setSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  return (
    <Section title="Check it came from us (optional)" hint="Every request has an X-Spag-Signature header: t=<time>,v1=<HMAC-SHA256 of “<time>.<body>”> made with this secret. Your system can check it to be sure the request came from Spag AI.">
      <div className="flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-3 py-2 text-xs">{secret ?? "•".repeat(32)}</code>
        {secret ? (
          <Button variant="outline" size="sm" onClick={async () => { await navigator.clipboard.writeText(secret); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? <Check /> : <Copy />} Copy</Button>
        ) : (
          <Button variant="outline" size="sm" onClick={async () => { const r = await revealSigningSecret(id); if ("secret" in r) setSecret(r.secret); else setError(r.error); }}><Eye /> Show</Button>
        )}
        <Button variant="ghost" size="sm" onClick={async () => {
          if (!window.confirm("Make a new secret? The old one stops working straight away.")) return;
          const r = await rotateSigningSecret(id);
          if ("secret" in r) setSecret(r.secret); else setError(r.error);
        }}><RefreshCw /> New secret</Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </Section>
  );
}

function RunLog({ runs }: { runs: RunRow[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const time = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" }).format(new Date(iso));
  return (
    <section className="space-y-3">
      <h2 className="font-medium">Recent runs <span className="text-sm font-normal text-muted-foreground">(last 50)</span></h2>
      {runs.length === 0 ? <p className="text-sm text-muted-foreground">Nothing yet. Send a test, or talk to an agent that uses this tool.</p> : (
        <ul className="divide-y rounded-xl border">
          {runs.map((r) => (
            <li key={r.id}>
              <button type="button" className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-muted/50" onClick={() => setOpen(open === r.id ? null : r.id)}>
                <span className={cn("size-2 shrink-0 rounded-full", r.ok ? "bg-emerald-500" : "bg-destructive")} />
                <span className="w-28 shrink-0 text-muted-foreground">{time(r.createdAt)}</span>
                <span className="w-32 shrink-0 truncate">{SOURCE[r.source] ?? r.source}</span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{r.status ? `${r.status} · ` : ""}{r.response}</span>
                <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">{r.durationMs} ms</span>
                <ChevronDown className={cn("size-4 shrink-0 transition-transform", open === r.id && "rotate-180")} />
              </button>
              {open === r.id && (
                <div className="grid gap-3 px-4 pb-4 md:grid-cols-2">
                  <div><p className="mb-1 text-xs font-medium text-muted-foreground">Sent</p><pre className="max-h-64 overflow-auto rounded-lg bg-muted p-2 text-xs">{JSON.stringify(r.request, null, 2)}</pre></div>
                  <div><p className="mb-1 text-xs font-medium text-muted-foreground">Reply</p><pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-muted p-2 text-xs">{r.response}</pre></div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
