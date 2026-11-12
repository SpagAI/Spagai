"use client";

import { BookOpen, FileText, Globe, Phone, Plus } from "lucide-react";
import Link from "next/link";
import { assignAgent } from "@/app/(app)/numbers/actions";
import { AutoSubmitSelect } from "@/components/confirm-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export interface AgentConnections {
  knowledge: { id: string; name: string; kind: "FILE" | "WEBSITE"; status: string }[];
  numbers: { id: string; number: string; label: string }[];
  /** Numbers not used by any agent yet, which can be given to this one */
  freeNumbers: { id: string; number: string; label: string }[];
  canManageNumbers: boolean;
  canEditKnowledge: boolean;
  testedInLab: boolean;
}

export function KnowledgeTab({ agentId, c }: { agentId: string; c: AgentConnections }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><BookOpen className="size-5 text-primary" /> Knowledge base</CardTitle>
        <CardDescription>Documents and websites this agent uses to answer questions about your business.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {c.knowledge.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">Nothing yet. Add a price list, FAQ or your website.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {c.knowledge.map((k) => (
              <li key={k.id} className="flex items-center gap-2.5 px-3 py-2 text-sm">
                {k.kind === "FILE" ? <FileText className="size-4 text-muted-foreground" /> : <Globe className="size-4 text-muted-foreground" />}
                <span className="min-w-0 flex-1 truncate">{k.name}</span>
                <span className="text-xs text-muted-foreground">{k.status === "READY" ? "Ready" : k.status === "PROCESSING" ? "Reading…" : "Failed"}</span>
              </li>
            ))}
          </ul>
        )}
        {c.canEditKnowledge && (
          <Button asChild variant="outline" size="sm"><Link href={`/knowledge?agent=${agentId}`}><Plus /> Add files or a website</Link></Button>
        )}
      </CardContent>
    </Card>
  );
}

export function NumbersTab({ agentId, c }: { agentId: string; c: AgentConnections }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Phone className="size-5 text-primary" /> Phone number</CardTitle>
        <CardDescription>The number this agent calls from and answers on.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {c.numbers.length > 0 && (
          <ul className="divide-y rounded-lg border">
            {c.numbers.map((n) => (
              <li key={n.id} className="flex items-center gap-2.5 px-3 py-2 text-sm">
                <Phone className="size-4 text-primary" />
                <span className="font-medium tabular-nums">{n.number}</span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{n.label}</span>
                {c.canManageNumbers && (
                  <form action={assignAgent}>
                    <input type="hidden" name="id" value={n.id} />
                    <input type="hidden" name="agentId" value="" />
                    <Button type="submit" variant="ghost" size="sm">Remove</Button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
        {c.canManageNumbers ? (
          <div className="flex flex-wrap items-center gap-2">
            {c.freeNumbers.length > 0 && (
              <form action={assignAgent}>
                <input type="hidden" name="agentId" value={agentId} />
                <AutoSubmitSelect name="id" defaultValue="" aria-label="Give this agent a number" className="h-9 rounded-md border border-input bg-background px-2 text-sm">
                  <option value="" disabled>Use one of your numbers…</option>
                  {c.freeNumbers.map((n) => <option key={n.id} value={n.id}>{n.number}{n.label ? ` · ${n.label}` : ""}</option>)}
                </AutoSubmitSelect>
              </form>
            )}
            <Button asChild variant="outline" size="sm"><Link href="/numbers"><Plus /> Buy a new number</Link></Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Ask an owner or admin to connect a number.</p>
        )}
      </CardContent>
    </Card>
  );
}

/** Where the agent is in its setup: name, voice, instructions, knowledge, number, tested. */
