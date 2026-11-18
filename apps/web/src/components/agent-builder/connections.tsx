"use client";

import { BookOpen, Loader2, Network, Phone, PhoneCall, Plus } from "lucide-react";
import type { KnowledgeRow } from "@/app/(app)/knowledge/actions";
import { KnowledgeManager } from "@/app/(app)/knowledge/knowledge-manager";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { assignAgent, placeTestCall, setNumberDirections, type TestCallResult } from "@/app/(app)/numbers/actions";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { AutoSubmitSelect } from "@/components/confirm-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export interface AgentConnections {
  knowledge: KnowledgeRow[];
  numbers: { id: string; number: string; label: string; source?: string; inboundEnabled?: boolean; outboundEnabled?: boolean }[];
  /** Numbers not used by any agent yet, which can be given to this one */
  freeNumbers: { id: string; number: string; label: string }[];
  canManageNumbers: boolean;
  /** Whether the phone system (live call audio) is connected yet. */
  telephony?: { connected: boolean; message: string };
  canEditKnowledge: boolean;
  testedInLab: boolean;
}

/** The agent's whole knowledge base, managed in place (same screen as the Knowledge Base page). */
export function KnowledgeTab({ agentId, agentName, c }: { agentId: string; agentName: string; c: AgentConnections }) {
  return (
    <div className="space-y-4 pt-1">
      <h2 className="flex items-center gap-2 text-lg font-semibold"><BookOpen className="size-5 text-primary" /> Knowledge base</h2>
      <KnowledgeManager agentId={agentId} agentName={agentName} initial={c.knowledge} canEdit={c.canEditKnowledge} />
    </div>
  );
}

/** Ring the person's own phone and connect it to this agent (once the phone system is connected). */
function CallMyPhone({ agentId, canCall }: { agentId: string; canCall: boolean }) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState("");
  const [result, setResult] = useState<TestCallResult | null>(null);
  const [pending, start] = useTransition();
  if (!open) return <Button variant="outline" size="sm" onClick={() => setOpen(true)} disabled={!canCall} title={canCall ? undefined : "Give this agent a number that can make calls first"}><PhoneCall /> Call my phone</Button>;
  return (
    <div className="w-full space-y-2 rounded-lg border p-3">
      <p className="text-sm font-medium">Call my phone</p>
      <p className="text-xs text-muted-foreground">The agent rings this number from its own number, like a real call.</p>
      <div className="flex flex-wrap gap-2">
        <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="+2348031234567" inputMode="tel" className="h-9 max-w-56" aria-label="Your phone number" />
        <Button size="sm" disabled={pending || !to.trim()} onClick={() => start(async () => setResult(await placeTestCall(agentId, to)))}>{pending ? <Loader2 className="animate-spin" /> : <PhoneCall />} Call now</Button>
        <Button size="sm" variant="ghost" onClick={() => { setOpen(false); setResult(null); }}>Cancel</Button>
      </div>
      {result && <p className={cn("text-sm", result.ok ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>{result.message}</p>}
    </div>
  );
}

export function NumbersTab({ agentId, c }: { agentId: string; c: AgentConnections }) {
  const [numbers, setNumbers] = useState(c.numbers);
  // A number added or removed on the server: show the new list.
  useEffect(() => setNumbers(c.numbers), [c.numbers]);
  const setDirections = (id: string, inbound: boolean, outbound: boolean) => {
    setNumbers((list) => list.map((n) => (n.id === id ? { ...n, inboundEnabled: inbound, outboundEnabled: outbound } : n)));
    void setNumberDirections(id, inbound, outbound);
  };
  return (
    <div className="space-y-4">
      {c.telephony && !c.telephony.connected && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
          <Network className="mt-0.5 size-5 shrink-0 text-amber-600" />
          <div>
            <p className="font-medium">Phone system not connected yet</p>
            <p className="text-muted-foreground">You can add phone lines and give this agent numbers now; real calls start once the phone system is connected. Until then, test the agent with Talk to agent.</p>
          </div>
        </div>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Phone className="size-5 text-primary" /> Phone number</CardTitle>
          <CardDescription>The numbers this agent answers calls on and calls people from.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {numbers.length === 0 && <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No number yet. Give this agent one of your numbers, or connect a phone line (SIP trunk) from your provider.</p>}
          {numbers.length > 0 && (
            <ul className="divide-y rounded-lg border">
              {numbers.map((n) => (
                <li key={n.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5 text-sm">
                  <span className="flex min-w-0 flex-1 items-center gap-2.5">
                    <Phone className="size-4 shrink-0 text-primary" />
                    <span className="font-medium tabular-nums">{n.number}</span>
                    <span className="truncate text-xs text-muted-foreground">{[n.label, n.source && n.source !== "Spag AI" ? `via ${n.source}` : ""].filter(Boolean).join(" · ")}</span>
                  </span>
                  <label className="flex items-center gap-2 text-xs"><Switch checked={n.inboundEnabled !== false} disabled={!c.canManageNumbers} onCheckedChange={(v) => setDirections(n.id, v, n.outboundEnabled !== false)} aria-label={`Answers calls on ${n.number}`} /> Answers calls</label>
                  <label className="flex items-center gap-2 text-xs"><Switch checked={n.outboundEnabled !== false} disabled={!c.canManageNumbers} onCheckedChange={(v) => setDirections(n.id, n.inboundEnabled !== false, v)} aria-label={`Makes calls from ${n.number}`} /> Makes calls</label>
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
              <Button asChild variant="outline" size="sm"><Link href="/numbers"><Network /> Connect a phone line (SIP trunk)</Link></Button>
              <Button asChild variant="ghost" size="sm"><Link href="/numbers"><Plus /> Buy a number</Link></Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Ask an owner or admin to connect a number.</p>
          )}
          <div className="border-t pt-3">
            <CallMyPhone agentId={agentId} canCall={numbers.some((n) => n.outboundEnabled !== false)} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** Where the agent is in its setup: name, voice, instructions, knowledge, number, tested. */
