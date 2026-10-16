"use client";

import { FileUp, Globe, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { fileSize } from "@/lib/file-size";
import { cn } from "@/lib/utils";
import { addFiles, addWebsite, type KnowledgeFormState } from "./actions";

type AgentOption = { id: string; name: string };

function AgentSelect({ agents, id, defaultValue }: { agents: AgentOption[]; id: string; defaultValue?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>Agent that uses it</Label>
      <Select id={id} name="agentId" defaultValue={defaultValue ?? agents[0]?.id ?? ""} required>
        {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
      </Select>
    </div>
  );
}

export function UploadFiles({ agents, defaultAgent }: { agents: AgentOption[]; defaultAgent?: string }) {
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, action, pending] = useActionState<KnowledgeFormState, FormData>(async (prev, form) => {
    const result = await addFiles(prev, form);
    if (result.status === "ok") setFiles([]);
    return result;
  }, { status: "idle" });
  const pick = (list: FileList | null) => list && setFiles((f) => [...f, ...Array.from(list)].slice(0, 10));

  return (
    <form action={action} className="space-y-4">
      {/* Only the details are sent, not the file itself (prototype). */}
      <input type="hidden" name="files" value={JSON.stringify(files.map((f) => ({ name: f.name, size: f.size, type: f.type })))} />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); pick(e.dataTransfer.files); }}
        className={cn("flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-7 text-center transition-colors", dragging ? "border-primary bg-primary/5" : "hover:border-primary/50 hover:bg-muted/50")}
      >
        <FileUp className="size-7 text-primary" />
        <span className="text-sm font-medium">Drop files here, or click to choose</span>
        <span className="text-xs text-muted-foreground">PDF, Word, Excel, PowerPoint, CSV or text · up to 20 MB each</span>
      </button>
      <input ref={inputRef} type="file" multiple hidden accept=".pdf,.doc,.docx,.txt,.md,.csv,.xls,.xlsx,.ppt,.pptx" onChange={(e) => { pick(e.target.files); e.target.value = ""; }} />
      {files.length > 0 && (
        <ul className="space-y-1">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-md bg-muted/60 px-2.5 py-1.5 text-sm">
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <span className="text-xs tabular-nums text-muted-foreground">{fileSize(f.size)}</span>
              <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label={`Remove ${f.name}`} className="rounded p-0.5 text-muted-foreground hover:bg-background"><X className="size-3.5" /></button>
            </li>
          ))}
        </ul>
      )}
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <AgentSelect agents={agents} id="file-agent" defaultValue={defaultAgent} />
        <Button type="submit" disabled={pending || files.length === 0}>{pending ? <Loader2 className="animate-spin" /> : <FileUp />} Upload {files.length > 0 ? files.length : ""}</Button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

export function AddWebsite({ agents, defaultAgent }: { agents: AgentOption[]; defaultAgent?: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<KnowledgeFormState, FormData>(addWebsite, { status: "idle" });
  useEffect(() => { if (state.status === "ok") formRef.current?.reset(); }, [state]);
  return (
    <form ref={formRef} action={action} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="kb-url">Website address</Label>
        <div className="relative">
          <Globe className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input id="kb-url" name="url" required placeholder="https://mybusiness.com" className="pl-8" inputMode="url" />
        </div>
      </div>
      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium">What to read</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {[["site", "The whole website", "Follows links on the same site (up to 50 pages)"], ["page", "Just this page", "Only the address above"]].map(([value, title, help]) => (
            <label key={value} className="flex cursor-pointer gap-2 rounded-lg border p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5">
              <input type="radio" name="scope" value={value} defaultChecked={value === "site"} className="mt-0.5 accent-[var(--primary)]" />
              <span><span className="block font-medium">{title}</span><span className="text-xs text-muted-foreground">{help}</span></span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <AgentSelect agents={agents} id="url-agent" defaultValue={defaultAgent} />
        <Button type="submit" disabled={pending}>{pending ? <Loader2 className="animate-spin" /> : <Globe />} Add website</Button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

/** While anything is still being read, check again every few seconds. */
export function RefreshWhileProcessing({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => router.refresh(), 2500);
    return () => clearInterval(id);
  }, [active, router]);
  return null;
}
