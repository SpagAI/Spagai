"use client";

import { ChevronRight, Globe2, MapPin } from "lucide-react";
import { useMemo, useState } from "react";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { compact, type LocationRow } from "@/lib/dashboard-types";

/** The flat map in /world-map.svg: x = (lng + 180) × 1000/360, y = (84 − lat) × 1000/360. */
const W = 1000;
const H = 394.4;
const project = (lng: number, lat: number) => [((lng + 180) * W) / 360, ((84 - lat) * W) / 360] as const;

const LEVELS = ["continent", "country", "region", "city"] as const;
type Level = (typeof LEVELS)[number];
type Path = Partial<Record<Level, string>>;
const LEVEL_NAMES: Record<Level, string> = { continent: "Continent", country: "Country", region: "State / region", city: "City" };
const PLURAL: Record<Level, string> = { continent: "continents", country: "countries", region: "states and regions", city: "cities" };
const ALL: Record<Level, string> = { continent: "All continents", country: "All countries", region: "All states", city: "All cities" };

interface Group { key: string; calls: number; answered: number; x: number; y: number; cities: number }

function within(rows: LocationRow[], path: Path) {
  return rows.filter((r) => LEVELS.every((l) => !path[l] || r[l] === path[l]));
}

function groupBy(rows: LocationRow[], level: Level): Group[] {
  const map = new Map<string, Group & { wx: number; wy: number }>();
  for (const r of rows) {
    const [x, y] = project(r.lng, r.lat);
    const g = map.get(r[level]) ?? { key: r[level], calls: 0, answered: 0, x: 0, y: 0, wx: 0, wy: 0, cities: 0 };
    g.calls += r.calls; g.answered += r.answered; g.wx += x * r.calls; g.wy += y * r.calls; g.cities += 1;
    map.set(r[level], g);
  }
  return [...map.values()].map((g) => ({ ...g, x: g.wx / g.calls, y: g.wy / g.calls })).sort((a, b) => b.calls - a.calls);
}

/** Scale and offset (in map units) that frame the given rows. */
function frame(rows: LocationRow[], zoomed: boolean) {
  if (!zoomed || rows.length === 0) return { s: 1, tx: 0, ty: 0 };
  const pts = rows.map((r) => project(r.lng, r.lat));
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const [x0, y0, x1, y1] = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  const minSpan = 24;
  const bw = Math.max(x1 - x0, minSpan) * 1.5, bh = Math.max(y1 - y0, minSpan * (H / W)) * 1.5;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const s = Math.min(Math.max(Math.min(W / bw, H / bh), 1), 9);
  const tx = Math.min(Math.max(cx * s - W / 2, 0), W * s - W);
  const ty = Math.min(Math.max(cy * s - H / 2, 0), H * s - H);
  return { s, tx, ty };
}

export function CallMap({ locations }: { locations: LocationRow[] }) {
  const [path, setPath] = useState<Path>({});
  const [hover, setHover] = useState<string | null>(null);

  const depth = LEVELS.findIndex((l) => !path[l]);
  const level: Level = depth === -1 ? "city" : LEVELS[depth]!;
  const rows = useMemo(() => within(locations, path), [locations, path]);
  const groups = useMemo(() => groupBy(rows, level), [rows, level]);
  const { s, tx, ty } = useMemo(() => frame(rows, depth !== 0), [rows, depth]);
  const total = rows.reduce((sum, r) => sum + r.calls, 0);
  const maxCalls = Math.max(...groups.map((g) => g.calls), 1);

  const drill = (key: string) => {
    if (depth === -1) return;
    setPath({ ...path, [level]: key });
    setHover(null);
  };
  const goTo = (i: number) => setPath(Object.fromEntries(LEVELS.slice(0, i).map((l) => [l, path[l]])) as Path);
  const choose = (l: Level, value: string) => {
    const i = LEVELS.indexOf(l);
    const next = Object.fromEntries(LEVELS.slice(0, i).map((k) => [k, path[k]])) as Path;
    if (value) next[l] = value;
    setPath(next);
  };
  const options = (l: Level) => {
    const i = LEVELS.indexOf(l);
    const parent = Object.fromEntries(LEVELS.slice(0, i).map((k) => [k, path[k]])) as Path;
    return [...new Set(within(locations, parent).map((r) => r[l]))].sort();
  };
  const crumbs = [{ label: "World", i: 0 }, ...LEVELS.flatMap((l, i) => (path[l] ? [{ label: path[l]!, i: i + 1 }] : []))];

  return (
    <section className="grid min-w-0 gap-4 rounded-xl border bg-card p-4 sm:p-5 lg:col-span-3 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="min-w-0 space-y-3">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Where calls come from</h2>
            <nav aria-label="Map location" className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
              {crumbs.map((c, n) => (
                <span key={c.label + n} className="inline-flex items-center gap-1">
                  {n > 0 && <ChevronRight className="size-3" aria-hidden />}
                  {n === crumbs.length - 1 ? (
                    <span className="font-medium text-foreground">{c.label}</span>
                  ) : (
                    <button type="button" onClick={() => goTo(c.i)} className="hover:text-foreground hover:underline">{c.label}</button>
                  )}
                </span>
              ))}
            </nav>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:grid-cols-4">
            {LEVELS.map((l, i) => (
              <Select
                key={l}
                aria-label={LEVEL_NAMES[l]}
                value={path[l] ?? ""}
                disabled={i > 0 && !path[LEVELS[i - 1]!]}
                onChange={(e) => choose(l, e.target.value)}
                className="h-8 text-xs sm:w-36"
              >
                <option value="">{ALL[l]}</option>
                {options(l).map((o) => <option key={o} value={o}>{o}</option>)}
              </Select>
            ))}
          </div>
        </header>

        <div className="relative overflow-hidden rounded-lg bg-muted/40" style={{ aspectRatio: `${W} / ${H}` }}>
          <div
            className="absolute inset-0 origin-top-left transition-transform duration-500 ease-out"
            style={{ transform: `translate(${(-tx / W) * 100}%, ${(-ty / H) * 100}%) scale(${s})` }}
            aria-hidden
          >
            <div
              className="size-full"
              style={{
                background: "var(--map-land)",
                maskImage: "url(/world-map.svg)", WebkitMaskImage: "url(/world-map.svg)",
                maskSize: "100% 100%", WebkitMaskSize: "100% 100%",
                maskMode: "luminance",
              }}
            />
          </div>
          {groups.map((g) => {
            const r = 5 + 17 * Math.sqrt(g.calls / maxCalls);
            const left = ((g.x * s - tx) / W) * 100, top = ((g.y * s - ty) / H) * 100;
            const active = hover === g.key;
            return (
              <button
                key={g.key}
                type="button"
                onClick={() => drill(g.key)}
                onMouseEnter={() => setHover(g.key)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(g.key)}
                onBlur={() => setHover(null)}
                aria-label={`${g.key}: ${g.calls} calls${depth === -1 ? "" : ". Show details"}`}
                className={cn("absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card transition-[left,top,width,height,opacity] duration-500 ease-out", depth === -1 && "cursor-default")}
                style={{ left: `${left}%`, top: `${top}%`, width: r * 2, height: r * 2, background: "var(--chart-1)", opacity: active ? 0.95 : 0.7, zIndex: active ? 2 : 1 }}
              />
            );
          })}
          {hover && (() => {
            const g = groups.find((x) => x.key === hover);
            if (!g) return null;
            const left = ((g.x * s - tx) / W) * 100, top = ((g.y * s - ty) / H) * 100;
            return (
              <div
                role="tooltip"
                className="pointer-events-none absolute z-10 w-max rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md"
                style={{ left: `${left}%`, top: `${top}%`, transform: `translate(${left > 65 ? "calc(-100% - 14px)" : "14px"}, -50%)` }}
              >
                <p className="font-medium">{g.key}</p>
                <p className="tabular-nums text-muted-foreground">{compact(g.calls)} calls · {Math.round((g.answered / g.calls) * 100)}% answered</p>
                {depth !== -1 && <p className="mt-0.5 text-muted-foreground">Click to zoom in</p>}
              </div>
            );
          })()}
          {groups.length === 0 && (
            <p className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">No calls with a known location in this period.</p>
          )}
        </div>
        <p className="text-xs text-muted-foreground">Circle size shows the number of calls. Click a circle, or use the menus, to zoom in.</p>
      </div>

      <aside className="min-w-0 space-y-3 lg:border-l lg:pl-4">
        <div>
          <h3 className="text-sm font-semibold">Top {depth === -1 ? "locations" : PLURAL[level]}</h3>
          <p className="text-xs tabular-nums text-muted-foreground">{compact(total)} calls{crumbs.length > 1 ? ` in ${crumbs[crumbs.length - 1]!.label}` : " worldwide"}</p>
        </div>
        <ol className="space-y-1">
          {groups.slice(0, 8).map((g, n) => (
            <li key={g.key}>
              <button
                type="button"
                onClick={() => drill(g.key)}
                onMouseEnter={() => setHover(g.key)}
                onMouseLeave={() => setHover(null)}
                disabled={depth === -1}
                className={cn("w-full rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted disabled:hover:bg-transparent", hover === g.key && "bg-muted")}
              >
                <span className="flex items-center gap-2 text-sm">
                  <span className="w-4 text-xs tabular-nums text-muted-foreground">{n + 1}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{g.key}</span>
                  <span className="tabular-nums">{compact(g.calls)}</span>
                </span>
                <span className="ml-6 mt-1 flex items-center gap-2">
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <span className="block h-full rounded-full" style={{ width: `${(g.calls / maxCalls) * 100}%`, background: "var(--chart-1)" }} />
                  </span>
                  <span className="w-20 text-right text-[11px] tabular-nums text-muted-foreground">{Math.round((g.answered / g.calls) * 100)}% answered</span>
                </span>
              </button>
            </li>
          ))}
        </ol>
        {depth === -1 && rows[0] && (
          <p className="flex items-center gap-1.5 rounded-md bg-muted/60 px-2 py-1.5 text-xs text-muted-foreground"><MapPin className="size-3.5" /> {rows[0].city}, {rows[0].region}, {rows[0].country}</p>
        )}
        {depth === 0 && groups.length > 0 && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Globe2 className="size-3.5" /> Calls reached {new Set(locations.map((l) => l.country)).size} countries</p>
        )}
      </aside>
    </section>
  );
}
