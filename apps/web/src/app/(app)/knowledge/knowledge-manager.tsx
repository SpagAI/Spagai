"use client";

import { ChevronDown, FileText, Globe, Loader2, PenLine, Trash2, TriangleAlert, Upload } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { SubTabs } from "@/components/sub-tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { fileSize } from "@/lib/file-size";
import { KNOWLEDGE_LIMITS } from "@/lib/knowledge";
import { cn } from "@/lib/utils";
import { addKnowledgeFiles, addKnowledgeText, addKnowledgeWebsite, deleteKnowledgeItem, previewKnowledge, type KnowledgeResult, type KnowledgeRow } from "./actions";
import { extractText } from "./extract";

type Note = { ok: boolean; text: string } | null;

function AddText({ agentId, onDone }: { agentId: string; onDone: (r: KnowledgeResult) => void }) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3">
      <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Title, e.g. Price list or Opening hours" aria-label="Title" />
      <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} placeholder={"Write or paste what the agent should know, e.g.\nTeeth cleaning: ₦15,000 (30 minutes)\nWe are open Monday to Friday, 8am to 6pm, and Saturday 10am to 2pm.\nParking is free behind the building."} aria-label="Knowledge text" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{text.length.toLocaleString("en")} / {KNOWLEDGE_LIMITS.itemChars.toLocaleString("en")} characters</span>
        <Button disabled={pending || !title.trim() || text.trim().length < 10} onClick={() => start(async () => { const r = await addKnowledgeText(agentId, title, text); onDone(r); if (r.ok) { setTitle(""); setText(""); } })}>
          {pending ? <Loader2 className="animate-spin" /> : <PenLine />} Add to knowledge base
        </Button>
      </div>
    </div>
  );
}

function AddFiles({ agentId, onDone }: { agentId: string; onDone: (r: KnowledgeResult) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const pick = (list: FileList | null) => {
    if (!list?.length) return;
    const chosen = [...list].slice(0, 10);
    start(async () => {
      const files: { name: string; size: number; type: string; text: string }[] = [];
      const problems: string[] = [];
      for (const [i, f] of chosen.entries()) {
        setStatus(`Reading ${f.name} (${i + 1} of ${chosen.length})…`);
        try {
          files.push({ name: f.name, size: f.size, type: f.type, text: (await extractText(f)).slice(0, KNOWLEDGE_LIMITS.itemChars) });
        } catch (e) {
          problems.push(`${f.name}: ${e instanceof Error && e.message.startsWith("Use ") ? e.message : "could not be read (it may be scanned images or protected)."}`);
        }
      }
      setStatus(files.length ? "Saving…" : null);
      if (files.length) {
        const r = await addKnowledgeFiles(agentId, files);
        onDone(r.ok && problems.length ? { ...r, message: `${r.message} ${problems.join(" ")}` } : r);
      } else onDone({ ok: false, error: problems.join(" ") });
      setStatus(null);
      if (input.current) input.current.value = "";
    });
  };
  return (
    <div
      className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-6 text-center"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files); }}
    >
      <Upload className="size-7 text-muted-foreground" />
      <p className="font-medium">Drop files here, or choose them</p>
      <p className="text-xs text-muted-foreground">PDF, Word (.docx), text, Markdown or CSV · up to 10 at a time. Scanned pictures of pages cannot be read.</p>
      <input ref={input} type="file" multiple accept=".pdf,.docx,.txt,.md,.markdown,.csv" className="hidden" onChange={(e) => pick(e.target.files)} />
      <Button variant="outline" disabled={pending} onClick={() => input.current?.click()}>{pending ? <Loader2 className="animate-spin" /> : <FileText />} Choose files</Button>
      {status && <p className="text-sm text-muted-foreground">{status}</p>}
    </div>
  );
}

function AddWebsite({ agentId, onDone }: { agentId: string; onDone: (r: KnowledgeResult) => void }) {
  const [url, setUrl] = useState("");
  const [whole, setWhole] = useState(true);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3">
      <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://mybusiness.com" inputMode="url" aria-label="Website address" />
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2"><input type="radio" checked={whole} onChange={() => setWhole(true)} className="accent-[var(--color-primary)]" /> This page and up to {KNOWLEDGE_LIMITS.sitePages - 1} more pages of the site</label>
        <label className="flex items-center gap-2"><input type="radio" checked={!whole} onChange={() => setWhole(false)} className="accent-[var(--color-primary)]" /> Only this page</label>
      </div>
      <Button disabled={pending || !url.trim()} onClick={() => start(async () => { const r = await addKnowledgeWebsite(agentId, url, whole); onDone(r); if (r.ok) setUrl(""); })}>
        {pending ? <><Loader2 className="animate-spin" /> Reading the website…</> : <><Globe /> Read website</>}
      </Button>
    </div>
  );
}

function ItemRow({ item, canEdit, onChange }: { item: KnowledgeRow; canEdit: boolean; onChange: (r: KnowledgeResult) => void }) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<{ text: string; more: boolean } | null>(null);
  const [pending, start] = useTransition();
  const notRead = item.status === "READY" && item.contentChars === 0;
  const Icon = item.kind === "WEBSITE" ? Globe : item.kind === "TEXT" ? PenLine : FileText;
  const toggle = () => {
    setOpen((o) => !o);
    if (!preview && !notRead && item.status === "READY") start(async () => { const r = await previewKnowledge(item.id); if (!("error" in r)) setPreview(r); });
  };
  const detail = [
    item.kind === "WEBSITE" ? `${item.pages} page${item.pages === 1 ? "" : "s"}` : item.sizeBytes ? fileSize(item.sizeBytes) : "",
    item.contentChars ? `${item.contentChars.toLocaleString("en")} characters · ${item.chunks} piece${item.chunks === 1 ? "" : "s"}` : "",
  ].filter(Boolean).join(" · ");
  return (
    <li>
      <div className="flex items-center gap-3 px-3 py-2.5 text-sm">
        <Icon className="size-4 shrink-0 text-muted-foreground" />
        <button type="button" className="min-w-0 flex-1 text-left" onClick={toggle}>
          <span className="block truncate font-medium">{item.name}</span>
          <span className="block truncate text-xs text-muted-foreground">{detail || (item.kind === "WEBSITE" ? item.url : "")}</span>
        </button>
        {item.status === "FAILED" ? (
          <span className="flex items-center gap-1 text-xs text-destructive" title={item.error ?? undefined}><TriangleAlert className="size-3.5" /> Could not read</span>
        ) : notRead ? (
          <span className="text-xs text-amber-600" title="Added before the knowledge base read content. Remove it and add it again so the agent can use it.">Not read · add again</span>
        ) : item.status === "PROCESSING" ? (
          <span className="text-xs text-muted-foreground">Reading…</span>
        ) : (
          <span className="text-xs text-emerald-600 dark:text-emerald-400">Ready</span>
        )}
        <button type="button" aria-label={open ? "Hide" : "Show what the agent knows"} onClick={toggle} className="p-1"><ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} /></button>
        {canEdit && (
          <Button variant="ghost" size="icon" aria-label={`Remove ${item.name}`} className="text-muted-foreground hover:text-destructive" onClick={async () => { if (window.confirm(`Remove “${item.name}” from the knowledge base?`)) onChange(await deleteKnowledgeItem(item.id)); }}><Trash2 /></Button>
        )}
      </div>
      {open && (
        <div className="px-3 pb-3">
          {item.status === "FAILED" ? <p className="text-sm text-destructive">{item.error}</p> : notRead ? (
            <p className="text-sm text-muted-foreground">This was added before the knowledge base could read content, so the agent does not know it yet. Remove it and add it again.</p>
          ) : pending || !preview ? <p className="text-sm text-muted-foreground">Loading…</p> : (
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-3 font-sans text-xs">{preview.text}{preview.more ? "\n\n…" : ""}</pre>
          )}
        </div>
      )}
    </li>
  );
}

/** Everything about one agent's knowledge base: add text, files or a website; see, check and remove items. */
export function KnowledgeManager({ agentId, agentName, initial, canEdit }: { agentId: string; agentName: string; initial: KnowledgeRow[]; canEdit: boolean }) {
  const [items, setItems] = useState(initial);
  const [note, setNote] = useState<Note>(null);
  useEffect(() => setItems(initial), [initial]);
  const done = (r: KnowledgeResult) => {
    if (r.ok) setItems(r.items);
    setNote(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });
  };
  const total = items.reduce((s, i) => s + i.contentChars, 0);
  const pct = Math.min(100, Math.round((total / KNOWLEDGE_LIMITS.agentChars) * 100));
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          What {agentName || "this agent"} knows about your business: prices, services, opening hours, FAQs. During a call it looks up the parts that match what the caller asks{total <= KNOWLEDGE_LIMITS.wholeChars ? " (a small knowledge base like this one is read in full)" : ""}.
        </p>
        <div className="flex gap-5 text-sm">
          <div><p className="text-xs text-muted-foreground">Items</p><p className="text-lg font-semibold tabular-nums">{items.length}</p></div>
          <div><p className="text-xs text-muted-foreground">Characters</p><p className="text-lg font-semibold tabular-nums" title={`${pct}% of ${KNOWLEDGE_LIMITS.agentChars.toLocaleString("en")}`}>{total.toLocaleString("en")}</p></div>
        </div>
      </div>

      {canEdit ? (
        <div className="rounded-xl border p-4">
          <SubTabs
            label="Add knowledge"
            tabs={[
              { id: "text", label: "Write text", icon: <PenLine />, content: <AddText agentId={agentId} onDone={done} /> },
              { id: "files", label: "Upload files", icon: <Upload />, content: <AddFiles agentId={agentId} onDone={done} /> },
              { id: "website", label: "Website", icon: <Globe />, content: <AddWebsite agentId={agentId} onDone={done} /> },
            ]}
          />
        </div>
      ) : (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">Only owners, admins and editors can change the knowledge base.</p>
      )}

      {note && (
        <p role="status" className={cn("rounded-lg border px-3 py-2 text-sm", note.ok ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400" : "border-destructive/40 bg-destructive/5 text-destructive")}>{note.text}</p>
      )}

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Nothing yet. Add your price list, FAQs or your website, so the agent answers from your own information.</p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {items.map((i) => <ItemRow key={i.id} item={i} canEdit={canEdit} onChange={done} />)}
        </ul>
      )}
    </div>
  );
}
