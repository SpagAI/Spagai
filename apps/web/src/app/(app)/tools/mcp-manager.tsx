"use client";

import { ChevronDown, KeyRound, Loader2, Plug, Plus, RefreshCw, Send, Trash2, X } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { McpToolInfo } from "@/lib/mcp";
import { cn } from "@/lib/utils";
import { deleteMcpServer, listMcpRuns, refreshMcpServer, saveMcpServer, setMcpToolAllowed, testMcpTool, type McpServerSummary } from "./mcp-actions";

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/^(\d)/, "m_$1").slice(0, 20);
const ago = (iso: string | null) => {
  if (!iso) return "never";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  return mins < 1 ? "just now" : mins < 60 ? `${mins} min ago` : mins < 1440 ? `${Math.round(mins / 60)} h ago` : `${Math.round(mins / 1440)} d ago`;
};

/** Connect (or edit) an MCP server: name, address (secret), optional access key. */
export function McpConnectForm({ server, onSaved, onCancel }: { server?: McpServerSummary; onSaved: (s: McpServerSummary) => void; onCancel: () => void }) {
  const [label, setLabel] = useState(server?.label ?? "");
  const [name, setName] = useState(server?.name ?? "");
  const [nameTouched, setNameTouched] = useState(Boolean(server));
  const [url, setUrl] = useState("");
  const [auth, setAuth] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const save = () =>
    start(async () => {
      setErrors([]);
      const r = await saveMcpServer(server?.id ?? null, { label, name, url, auth, clearAuth: false });
      if (r.ok) onSaved(r.server);
      else setErrors(r.errors);
    });
  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">{server ? `Edit ${server.label}` : "Connect an MCP server"}</p>
          <p className="text-xs text-muted-foreground">Its tools become available to your agents, like your webhook tools.</p>
        </div>
        <Button variant="ghost" size="icon" aria-label="Close" onClick={onCancel}><X /></Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Name</span>
          <Input value={label} maxLength={60} placeholder="Make" onChange={(e) => { setLabel(e.target.value); if (!nameTouched) setName(slug(e.target.value)); }} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Short name for tools</span>
          <Input value={name} maxLength={20} placeholder="make" className="font-mono" onChange={(e) => { setNameTouched(true); setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_")); }} />
          <span className="block text-xs text-muted-foreground">Tools are named like <code>{name || "make"}__book_appointment</code>.</span>
        </label>
      </div>
      <label className="block space-y-1 text-sm">
        <span className="font-medium">Server address</span>
        <Input type="password" autoComplete="off" value={url} className="font-mono" placeholder={server ? `Saved (${server.host}); leave empty to keep` : "https://eu2.make.com/mcp/u/…/stateless"} onChange={(e) => setUrl(e.target.value.trim())} />
        <span className="block text-xs text-muted-foreground">
          Make.com: create an MCP token in Make (your profile, API / MCP access), then use <code>https://&lt;your zone&gt;.make.com/mcp/u/&lt;token&gt;/stateless</code>. The address contains your token, so it is stored encrypted and never shown again.
        </span>
      </label>
      <label className="block space-y-1 text-sm">
        <span className="flex items-center gap-1 font-medium"><KeyRound className="size-3.5" /> Access key (optional)</span>
        <Input type="password" autoComplete="off" value={auth} className="font-mono" placeholder="Bearer … (only if the server asks for an Authorization header)" onChange={(e) => setAuth(e.target.value)} />
      </label>
      {errors.length > 0 && <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">{errors.join(" ")}</div>}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={save} disabled={pending || !label || !name || (!server && !url)}>{pending ? <Loader2 className="animate-spin" /> : <Plug />} {server ? "Save and reconnect" : "Connect and list tools"}</Button>
      </div>
    </div>
  );
}

function ToolTest({ serverId, tool }: { serverId: string; tool: McpToolInfo }) {
  const props = Object.keys((tool.inputSchema.properties as Record<string, unknown>) ?? {});
  const [values, setValues] = useState<Record<string, string>>({});
  const [result, setResult] = useState<Awaited<ReturnType<typeof testMcpTool>> | null>(null);
  const [pending, start] = useTransition();
  const run = () =>
    start(async () => {
      const args: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(values)) {
        if (v === "") continue;
        const type = ((tool.inputSchema.properties as Record<string, { type?: string }>)[k] ?? {}).type;
        args[k] = type === "number" || type === "integer" ? Number(v) : type === "boolean" ? v === "true" : type === "object" || type === "array" ? (() => { try { return JSON.parse(v); } catch { return v; } })() : v;
      }
      setResult(await testMcpTool(serverId, tool.name, args));
    });
  return (
    <div className="space-y-2 rounded-lg bg-muted/40 p-3">
      {props.length === 0 && <p className="text-xs text-muted-foreground">This tool takes no details.</p>}
      <div className="grid gap-2 sm:grid-cols-2">
        {props.map((p) => <Input key={p} aria-label={p} placeholder={p} value={values[p] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [p]: e.target.value }))} className="h-8 text-sm" />)}
      </div>
      <Button size="sm" variant="outline" disabled={pending} onClick={run}>{pending ? <Loader2 className="animate-spin" /> : <Send />} Send a test</Button>
      {result && ("error" in result ? <p className="text-sm text-destructive">{result.error}</p> : (
        <div className="space-y-1">
          <p className={cn("text-sm font-medium", result.ok ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>{result.ok ? "It worked" : "It did not work"} · {result.durationMs} ms</p>
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-md bg-background p-2 text-xs">{result.response}</pre>
        </div>
      ))}
    </div>
  );
}

function Runs({ serverId }: { serverId: string }) {
  const [runs, setRuns] = useState<Awaited<ReturnType<typeof listMcpRuns>> | null>(null);
  const [pending, start] = useTransition();
  if (!runs) return <button type="button" className="text-xs text-primary hover:underline" disabled={pending} onClick={() => start(async () => setRuns(await listMcpRuns(serverId)))}>{pending ? "Loading…" : "Show recent runs"}</button>;
  return runs.length === 0 ? <p className="text-xs text-muted-foreground">No runs yet.</p> : (
    <ul className="divide-y rounded-lg border text-xs">
      {runs.map((r) => (
        <li key={r.id} className="flex items-center gap-2 px-3 py-1.5">
          <span className={cn("size-2 shrink-0 rounded-full", r.ok ? "bg-emerald-500" : "bg-destructive")} />
          <code className="shrink-0">{r.toolName}</code>
          <span className="min-w-0 flex-1 truncate text-muted-foreground">{r.response}</span>
          <span className="shrink-0 text-muted-foreground">{ago(r.createdAt)}</span>
        </li>
      ))}
    </ul>
  );
}

/** One connected server: its tools (allowed or not), refresh, edit, delete, test. */
function ServerCard({ server, onChange, onDelete }: { server: McpServerSummary; onChange: (s: McpServerSummary) => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const allowed = server.tools.filter((t) => t.allowed).length;
  if (editing) return <McpConnectForm server={server} onSaved={(s) => { onChange(s); setEditing(false); }} onCancel={() => setEditing(false)} />;
  return (
    <div className="rounded-xl border">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Plug className="size-4" /></span>
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setOpen((o) => !o)}>
          <span className="block font-medium">{server.label} <code className="ml-1 text-xs font-normal text-muted-foreground">{server.name}</code></span>
          <span className="block text-xs text-muted-foreground">{server.host} · {allowed} of {server.tools.length} tools allowed · checked {ago(server.lastSyncedAt)}</span>
        </button>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" disabled={pending} title="Read the tool list again" onClick={() => start(async () => { setError(null); const r = await refreshMcpServer(server.id); if (r.ok) onChange(r.server); else setError(r.errors.join(" ")); })}>
            {pending ? <Loader2 className="animate-spin" /> : <RefreshCw />} Refresh
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>Edit</Button>
          <Button size="icon" variant="ghost" aria-label={`Delete ${server.label}`} className="text-destructive" onClick={async () => { if (window.confirm(`Disconnect ${server.label}? Agents using its tools will stop using them.`)) { await deleteMcpServer(server.id); onDelete(); } }}><Trash2 /></Button>
          <button type="button" aria-label={open ? "Hide tools" : "Show tools"} onClick={() => setOpen((o) => !o)} className="p-1"><ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} /></button>
        </div>
      </div>
      {(error || server.lastError) && <p className="px-4 pb-2 text-xs text-destructive">{error ?? server.lastError}</p>}
      {open && (
        <div className="space-y-2 border-t px-4 py-3">
          {server.tools.length === 0 && <p className="text-sm text-muted-foreground">This server offers no tools yet. In Make, give a scenario on-demand scheduling and allow it as a tool, then press Refresh.</p>}
          {server.tools.map((t) => (
            <div key={t.name} className="space-y-2">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium"><code>{t.name}</code></p>
                  {t.description && <p className="line-clamp-2 text-xs text-muted-foreground">{t.description}</p>}
                  <button type="button" className="text-xs text-primary hover:underline" onClick={() => setTesting(testing === t.name ? null : t.name)}>{testing === t.name ? "Hide test" : "Test"}</button>
                </div>
                <label className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                  {t.allowed ? "Allowed" : "Not allowed"}
                  <Switch checked={t.allowed} aria-label={`Allow ${t.name}`} onCheckedChange={async (v) => { const r = await setMcpToolAllowed(server.id, t.name, v); if (r.ok) onChange(r.server); }} />
                </label>
              </div>
              {testing === t.name && <ToolTest serverId={server.id} tool={t} />}
            </div>
          ))}
          <Runs serverId={server.id} />
        </div>
      )}
    </div>
  );
}

/** The Tools page section: connected MCP servers, and connecting a new one. */
export function McpManager({ initial, canManage }: { initial: McpServerSummary[]; canManage: boolean }) {
  const [servers, setServers] = useState(initial);
  const [adding, setAdding] = useState(false);
  return (
    <div className="space-y-3">
      {servers.length === 0 && !adding && (
        <div className="rounded-xl border border-dashed p-6 text-center">
          <Plug className="mx-auto size-7 text-muted-foreground" />
          <p className="mt-2 font-medium">No MCP servers connected</p>
          <p className="text-sm text-muted-foreground">Connect Make.com, Zapier, n8n or any MCP server to use all its actions as tools.</p>
        </div>
      )}
      {servers.map((s) => (
        <ServerCard key={s.id} server={s} onChange={(n) => setServers((list) => list.map((x) => (x.id === n.id ? n : x)))} onDelete={() => setServers((list) => list.filter((x) => x.id !== s.id))} />
      ))}
      {adding ? (
        <McpConnectForm onSaved={(s) => { setServers((list) => [...list, s]); setAdding(false); }} onCancel={() => setAdding(false)} />
      ) : canManage && (
        <Button variant="outline" size="sm" onClick={() => setAdding(true)}><Plus /> Connect an MCP server</Button>
      )}
    </div>
  );
}
