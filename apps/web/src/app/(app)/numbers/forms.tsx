"use client";

import { Loader2, Search, ShoppingCart, RefreshCw } from "lucide-react";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { FormMessage } from "@/components/form-message";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CountryTag } from "@/components/country-tag";
import { availableNumbers, formatNumber, NUMBER_COUNTRIES, TYPE_LABELS, type NumberType } from "@/lib/numbers";
import { DIRECTION_LABEL, providerById, SIP_PROVIDERS, type SipProviderId } from "@/lib/sip-providers";
import { cn } from "@/lib/utils";
import { addSipTrunk, buyNumber, type NumberFormState } from "./actions";

type AgentOption = { id: string; name: string };

export function BuyNumber({ agents, canManage, owned }: { agents: AgentOption[]; canManage: boolean; owned: string[] }) {
  const [country, setCountry] = useState("NG");
  const [type, setType] = useState<NumberType | "">("");
  const c = NUMBER_COUNTRIES.find((x) => x.code === country)!;
  const areas = c.areas.filter((a) => !type || a.type === type);
  const [area, setArea] = useState(areas[0]?.code ?? "");
  const [seed, setSeed] = useState(0);
  const [results, setResults] = useState<{ area: string; seed: number } | null>(null);
  const [searching, setSearching] = useState(false);
  const [state, action, pending] = useActionState<NumberFormState, FormData>(buyNumber, { status: "idle" });
  const offers = useMemo(() => (results ? availableNumbers(country, results.area, results.seed).filter((n) => !owned.includes(n.number)) : []), [country, results, owned]);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const search = (nextSeed = 0) => {
    setSearching(true);
    setSeed(nextSeed);
    // A short pause so it feels like a real carrier lookup.
    timer.current = setTimeout(() => { setResults({ area, seed: nextSeed }); setSearching(false); }, 450);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[1.3fr_1fr_1.3fr_auto] sm:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="buy-country">Country</Label>
          <Select id="buy-country" value={country} onChange={(e) => { const next = NUMBER_COUNTRIES.find((x) => x.code === e.target.value)!; setCountry(next.code); setType(""); setArea(next.areas[0]!.code); setResults(null); }}>
            {NUMBER_COUNTRIES.map((x) => <option key={x.code} value={x.code}>{x.name} ({x.dial})</option>)}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="buy-type">Type</Label>
          <Select id="buy-type" value={type} onChange={(e) => { const t = e.target.value as NumberType | ""; setType(t); setArea(c.areas.find((a) => !t || a.type === t)?.code ?? ""); setResults(null); }}>
            <option value="">Any type</option>
            {(Object.keys(c.price) as NumberType[]).map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="buy-area">Area code</Label>
          <Select id="buy-area" value={area} onChange={(e) => { setArea(e.target.value); setResults(null); }}>
            {areas.map((a) => <option key={a.code} value={a.code}>{a.code} · {a.name}</option>)}
          </Select>
        </div>
        <Button type="button" onClick={() => search(0)} disabled={searching || !area}>
          {searching ? <Loader2 className="animate-spin" /> : <Search />} Search
        </Button>
      </div>

      {searching && (
        <ul className="grid gap-2 sm:grid-cols-2" aria-hidden>
          {Array.from({ length: 4 }, (_, i) => <li key={i} className="h-16 animate-pulse rounded-lg bg-muted" />)}
        </ul>
      )}

      {!searching && results && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{offers.length} numbers available in {c.areas.find((a) => a.code === results.area)?.name}</span>
            <button type="button" onClick={() => search(seed + 1 > 20 ? 0 : seed + 1)} className="inline-flex items-center gap-1 hover:text-foreground"><RefreshCw className="size-3.5" /> Show other numbers</button>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {offers.map((o) => (
              <li key={o.number}>
                <form action={action} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
                  <input type="hidden" name="number" value={o.number} />
                  <input type="hidden" name="countryCode" value={country} />
                  <input type="hidden" name="areaCode" value={results.area} />
                  <input type="hidden" name="seed" value={results.seed} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium tabular-nums"><CountryTag code={country} />{formatNumber(o.number)}</p>
                    <p className="text-xs text-muted-foreground">{TYPE_LABELS[o.type]} · ₦{o.monthlyNaira.toLocaleString("en")}/month · Voice</p>
                  </div>
                  {agents.length > 0 && (
                    <Select name="agentId" defaultValue="" aria-label="Assign to agent" className="h-8 w-36 text-xs">
                      <option value="">No agent yet</option>
                      {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </Select>
                  )}
                  <Button type="submit" size="sm" disabled={pending || !canManage}><ShoppingCart /> Buy</Button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      )}
      <FormMessage state={state} />
      {!canManage && <p className="text-xs text-muted-foreground">Only owners and admins can buy numbers.</p>}
    </div>
  );
}

export function SipTrunkForm({ canManage }: { canManage: boolean }) {
  const [state, action, pending] = useActionState<NumberFormState, FormData>(addSipTrunk, { status: "idle" });
  const formRef = useRef<HTMLFormElement>(null);
  const [providerId, setProviderId] = useState<SipProviderId>("africas_talking");
  const [authMode, setAuthMode] = useState<"credentials" | "ip">("credentials");
  const provider = providerById(providerId);
  useEffect(() => { if (state.status === "ok") formRef.current?.reset(); }, [state]);
  return (
    <form ref={formRef} action={action} className="space-y-4">
      <input type="hidden" name="provider" value={providerId} />
      <input type="hidden" name="authMode" value={authMode} />
      <div className="space-y-1.5">
        <p className="text-sm font-medium">Your phone line provider</p>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Phone line provider">
          {SIP_PROVIDERS.map((p) => (
            <button key={p.id} type="button" role="radio" aria-checked={providerId === p.id} onClick={() => setProviderId(p.id)} className={cn("rounded-full border px-3 py-1 text-sm transition-colors", providerId === p.id ? "border-primary bg-primary text-primary-foreground" : "hover:border-primary/50 hover:bg-muted")}>
              {p.label}
            </button>
          ))}
        </div>
        <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground"><span className="font-medium text-foreground">Where to find these:</span> {provider.whereToFind}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5"><Label htmlFor="trunk-name">Name</Label><Input id="trunk-name" name="name" required minLength={2} maxLength={60} placeholder={`e.g. ${provider.label} line`} /></div>
        <div className="space-y-1.5">
          <Label htmlFor="trunk-direction">Used for</Label>
          <Select id="trunk-direction" name="direction" defaultValue="both">
            {Object.entries(DIRECTION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </div>
        <div className="grid grid-cols-[1fr_5.5rem_5.5rem] gap-2 sm:col-span-2">
          <div className="space-y-1.5"><Label htmlFor="trunk-host">SIP server address</Label><Input id="trunk-host" name="host" required placeholder={provider.hostExample} /></div>
          <div className="space-y-1.5"><Label htmlFor="trunk-port">Port</Label><Input id="trunk-port" name="port" type="number" defaultValue={provider.defaultTransport === "tls" ? 5061 : 5060} key={`port-${providerId}`} min={1} max={65535} /></div>
          <div className="space-y-1.5">
            <Label htmlFor="trunk-transport">Transport</Label>
            <Select id="trunk-transport" name="transport" defaultValue={provider.defaultTransport} key={`tr-${providerId}`}><option value="udp">UDP</option><option value="tcp">TCP</option><option value="tls">TLS</option></Select>
          </div>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <p className="text-sm font-medium">How your provider checks it is us</p>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="radio" checked={authMode === "credentials"} onChange={() => setAuthMode("credentials")} className="accent-[var(--color-primary)]" /> Username and password</label>
            <label className="flex items-center gap-2"><input type="radio" checked={authMode === "ip"} onChange={() => setAuthMode("ip")} className="accent-[var(--color-primary)]" /> My provider trusts your addresses</label>
          </div>
        </div>
        {authMode === "credentials" ? (
          <>
            <div className="space-y-1.5"><Label htmlFor="trunk-user">SIP username</Label><Input id="trunk-user" name="username" autoComplete="off" placeholder={`From ${provider.label}`} /></div>
            <div className="space-y-1.5"><Label htmlFor="trunk-pass">SIP password</Label><Input id="trunk-pass" name="password" type="password" autoComplete="new-password" placeholder="Stored encrypted" /></div>
          </>
        ) : (
          <p className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground sm:col-span-2">Our addresses for your provider&apos;s allow-list appear here once the phone system is connected.</p>
        )}
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="trunk-numbers">Phone numbers on this line</Label>
          <Textarea id="trunk-numbers" name="numbers" rows={2} placeholder="+2349012345678, +2349012345679" />
          <p className="text-xs text-muted-foreground">In international format, separated by commas or new lines. You can then give each number to an agent.</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending || !canManage}>{pending ? <><Loader2 className="animate-spin" /> Saving…</> : "Save phone line"}</Button>
        <FormMessage state={state} />
      </div>
      {!canManage && <p className="text-xs text-muted-foreground">Only owners and admins can connect phone lines.</p>}
    </form>
  );
}
