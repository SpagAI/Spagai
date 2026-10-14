import { formatNigerianPhone } from "@spagai/core";
import { Ban, Search, UserPlus } from "lucide-react";
import type { Metadata } from "next";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { getT } from "@/i18n/server";
import { formatLagos } from "@/lib/format";
import { requireOrg } from "@/server/auth/session";
import { db } from "@/server/db";
import { can } from "@/server/permissions";
import { addDoNotCall, addLead, optOutLead } from "./actions";
import { ImportForm } from "./import-form";

export const metadata: Metadata = { title: "Leads" };

const PAGE_SIZE = 200;

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const ctx = await requireOrg();
  const t = await getT();
  const canEdit = can(ctx.role, "lead:edit");
  const org = { organisationId: ctx.organisation.id };
  const q = (params.q ?? "").trim().slice(0, 60);
  const digits = q.replace(/\D/g, "").replace(/^0/, "");

  const [total, consented, optedOut, leads, dnc] = await Promise.all([
    db.lead.count({ where: org }),
    db.lead.count({ where: { ...org, consent: true, optedOut: false } }),
    db.lead.count({ where: { ...org, optedOut: true } }),
    db.lead.findMany({
      where: {
        ...org,
        ...(q && {
          OR: [
            { firstName: { contains: q, mode: "insensitive" } },
            { lastName: { contains: q, mode: "insensitive" } },
            { source: { contains: q, mode: "insensitive" } },
            ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : []),
          ],
        }),
      },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
    }),
    db.doNotCall.findMany({ where: org, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  const dncSet = new Set(dnc.map((d) => d.phone));

  const error =
    params.error === "phone" ? `${t("leads.badPhone")} ${params.reason ?? ""}` : params.error ? t("common.error") : null;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("leads.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("leads.intro")}</p>
      </div>

      {error && <Alert variant="destructive">{error}</Alert>}
      {params.saved && <Alert variant="success">{t("leads.saved")}</Alert>}
      {params.optedOut && <Alert variant="success">{t("leads.optedOutDone")}</Alert>}
      {params.dnc && <Alert variant="success">{t("leads.dncAdded")}</Alert>}

      <div className="grid grid-cols-3 gap-3">
        {[
          [t("leads.total"), total],
          [t("leads.callable"), consented],
          [t("leads.optedOut"), optedOut],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardHeader>
              <CardDescription>{label}</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      {canEdit && (
        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{t("leads.importTitle")}</CardTitle>
              <CardDescription>{t("leads.importIntro")}</CardDescription>
            </CardHeader>
            <CardContent><ImportForm /></CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("leads.addTitle")}</CardTitle>
              <CardDescription>{t("leads.addIntro")}</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={addLead} className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label htmlFor="firstName">{t("simulator.firstName")} *</Label><Input id="firstName" name="firstName" required maxLength={60} /></div>
                <div className="space-y-1.5"><Label htmlFor="lastName">{t("simulator.lastName")}</Label><Input id="lastName" name="lastName" maxLength={60} /></div>
                <div className="space-y-1.5"><Label htmlFor="title">{t("simulator.personTitle")}</Label><Input id="title" name="title" maxLength={20} placeholder="Dr" /></div>
                <div className="space-y-1.5">
                  <Label htmlFor="gender">{t("simulator.gender")}</Label>
                  <Select id="gender" name="gender" defaultValue="">
                    <option value="">{t("simulator.unknown")}</option>
                    <option value="male">{t("voices.male")}</option>
                    <option value="female">{t("voices.female")}</option>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label htmlFor="phone">{t("leads.phone")} *</Label><Input id="phone" name="phone" required inputMode="tel" placeholder="0803 123 4567" maxLength={30} /></div>
                <div className="space-y-1.5"><Label htmlFor="source">{t("leads.source")} *</Label><Input id="source" name="source" required maxLength={120} placeholder={t("leads.sourcePlaceholder")} /></div>
                <label className="col-span-2 flex items-start gap-2 text-sm">
                  <input type="checkbox" name="consent" className="mt-0.5 accent-[var(--primary)]" />
                  {t("leads.consentConfirm")}
                </label>
                <Button type="submit" className="col-span-2 sm:col-span-1"><UserPlus /> {t("leads.add")}</Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("leads.list")}</CardTitle>
          <form className="flex gap-2 pt-2" role="search">
            <Input name="q" defaultValue={q} placeholder={t("leads.search")} aria-label={t("leads.search")} className="max-w-sm" />
            <Button type="submit" variant="outline" size="icon" aria-label={t("leads.search")}><Search /></Button>
          </form>
        </CardHeader>
        <CardContent>
          {leads.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{q ? t("leads.noMatch") : t("leads.empty")}</p>
          ) : (
            <div className="-mx-6 overflow-x-auto px-6">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr className="border-b">
                    <th className="py-2 pr-3 font-medium">{t("leads.name")}</th>
                    <th className="py-2 pr-3 font-medium">{t("leads.phone")}</th>
                    <th className="py-2 pr-3 font-medium">{t("leads.source")}</th>
                    <th className="py-2 pr-3 font-medium">{t("leads.status")}</th>
                    <th className="py-2 font-medium"><span className="sr-only">{t("leads.actions")}</span></th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((l) => {
                    const blocked = l.optedOut || dncSet.has(l.phone);
                    return (
                      <tr key={l.id} className="border-b last:border-0">
                        <td className="py-2 pr-3">{[l.title, l.firstName, l.lastName].filter(Boolean).join(" ")}</td>
                        <td className="py-2 pr-3 font-mono text-xs whitespace-nowrap">{formatNigerianPhone(l.phone)}</td>
                        <td className="py-2 pr-3 text-muted-foreground">{l.source}</td>
                        <td className="py-2 pr-3">
                          {blocked ? (
                            <Badge variant="destructive">{t("leads.doNotCall")}</Badge>
                          ) : l.consent ? (
                            <Badge variant="secondary">{t("leads.ok")}</Badge>
                          ) : (
                            <Badge variant="warning">{t("leads.noConsent")}</Badge>
                          )}
                        </td>
                        <td className="py-2 text-right">
                          {canEdit && !blocked && (
                            <form action={optOutLead}>
                              <input type="hidden" name="leadId" value={l.id} />
                              <Button type="submit" variant="ghost" size="sm" className="text-destructive"><Ban /> {t("leads.optOut")}</Button>
                            </form>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {leads.length === PAGE_SIZE && <p className="pt-3 text-xs text-muted-foreground">{t("leads.firstN").replace("{count}", String(PAGE_SIZE))}</p>}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("leads.dncTitle")}</CardTitle>
          <CardDescription>{t("leads.dncIntro")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {canEdit && (
            <form action={addDoNotCall} className="flex flex-col gap-2 sm:flex-row">
              <Input name="phone" required inputMode="tel" placeholder="0803 123 4567" aria-label={t("leads.phone")} maxLength={30} />
              <Input name="note" placeholder={t("leads.dncNote")} aria-label={t("leads.dncNote")} maxLength={200} />
              <Button type="submit" variant="outline"><Ban /> {t("leads.dncAdd")}</Button>
            </form>
          )}
          {dnc.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("leads.dncEmpty")}</p>
          ) : (
            <ul className="divide-y text-sm">
              {dnc.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="font-mono text-xs">{formatNigerianPhone(d.phone)}</span>
                  <span className="text-xs text-muted-foreground">
                    {d.reason === "opt_out" ? t("leads.reasonOptOut") : t("leads.reasonManual")}
                    {d.note && ` · ${d.note}`} · {formatLagos(d.createdAt)} WAT
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
