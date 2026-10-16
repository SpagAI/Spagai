"use client";

import { Bell, BellRing, CircleHelp, CornerDownLeft, CreditCard, KeyRound, LifeBuoy, LogOut, PenLine, Search, ShieldCheck, Sparkles, UserRound, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { signOut } from "@/app/(app)/actions";
import { searchEverything } from "@/app/(app)/search-actions";
import { useT } from "@/i18n/client";
import { initialsOf, type SearchHit, type ShellNotification } from "@/lib/shell-types";
import { cn } from "@/lib/utils";
import { applyTheme, isTheme, type Theme } from "@/lib/theme";
import { ThemeSwitch } from "./theme-switch";
import { navFor } from "./nav-items";
import { useDismiss } from "./use-dismiss";

const POPOVER = "absolute z-[100] mt-2 rounded-xl border bg-popover text-popover-foreground shadow-lg";

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

interface Row {
  key: string;
  group: string;
  label: string;
  sub?: string;
  href: string;
  icon?: ReactNode;
}

function SearchBox({ role }: { role: string }) {
  const t = useT();
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(wrapRef, open, close);

  // Ctrl+K (or Cmd+K) jumps to the search box from anywhere.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Look up agents, leads and campaigns shortly after typing stops. Older answers are ignored.
  useEffect(() => {
    const q = value.trim();
    if (q.length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let current = true;
    const timer = setTimeout(() => {
      searchEverything(q)
        .then((r) => current && setHits(r))
        .catch(() => current && setHits([]))
        .finally(() => current && setLoading(false));
    }, 200);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [value]);

  const q = value.trim().toLowerCase();
  const pages: Row[] = navFor(role)
    .map((item) => ({ item, label: t(`nav.${item.key}`) }))
    .filter(({ label }) => (q ? label.toLowerCase().includes(q) : true))
    .slice(0, q ? 4 : 5)
    .map(({ item, label }) => ({ key: `page-${item.href}`, group: t("topbar.pages"), label, href: item.href, icon: <item.icon className="size-4" /> }));
  const found: Row[] = hits.map((h) => ({ key: h.key, group: t(`topbar.group.${h.group}`), label: h.label, sub: h.sub, href: h.href }));
  const rows = [...found, ...pages];

  const go = (row: Row | undefined) => {
    if (!row) return;
    setOpen(false);
    setValue("");
    inputRef.current?.blur();
    router.push(row.href);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (rows.length ? (i + (e.key === "ArrowDown" ? 1 : -1) + rows.length) % rows.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(rows[active] ?? rows[0]);
    }
  };

  let lastGroup = "";
  return (
    <div ref={wrapRef} className="relative w-full">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label={t("topbar.search")}
        placeholder={t("topbar.searchPlaceholder")}
        value={value}
        maxLength={60}
        autoComplete="off"
        onChange={(e) => {
          setValue(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="h-10 w-full rounded-full border border-input bg-card pr-14 pl-9 text-sm shadow-xs outline-none transition-shadow placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 [&::-webkit-search-cancel-button]:hidden"
      />
      <kbd className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded border bg-muted px-1.5 py-0.5 font-sans text-[10px] font-medium text-muted-foreground sm:block">Ctrl K</kbd>

      {open && (
        <div id={listId} role="listbox" className={cn(POPOVER, "inset-x-0 max-h-[70vh] overflow-y-auto p-1.5")}>
          {loading && q.length >= 2 && found.length === 0 && <p className="px-3 py-2 text-sm text-muted-foreground">{t("topbar.searching")}</p>}
          {rows.length === 0 && !loading && <p className="px-3 py-2 text-sm text-muted-foreground">{t("topbar.noResults")}</p>}
          {rows.map((row, i) => {
            const header = row.group !== lastGroup ? row.group : null;
            lastGroup = row.group;
            return (
              <div key={row.key}>
                {header && <p className="px-3 pt-2 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{header}</p>}
                <button
                  type="button"
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(row)}
                  className={cn("flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm", i === active ? "bg-accent text-accent-foreground" : "hover:bg-accent/60")}
                >
                  {row.icon && <span className="text-muted-foreground">{row.icon}</span>}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{row.label}</span>
                    {row.sub && <span className="block truncate text-xs text-muted-foreground">{row.sub}</span>}
                  </span>
                  {i === active && <CornerDownLeft className="size-3.5 text-muted-foreground" />}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

const SEEN_KEY = "spag.notifications.seen";
const TONE = { info: "bg-sky-500", warning: "bg-amber-500", success: "bg-primary" } as const;

function timeAgo(iso: string, now = Date.now()): string {
  const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function Notifications({ items }: { items: ShellNotification[] }) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState<string | null>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);

  // "Read" is remembered on this browser only.
  useEffect(() => {
    try {
      setSeen(window.localStorage.getItem(SEEN_KEY) ?? "");
    } catch {
      setSeen("");
    }
  }, []);
  const unread = seen === null ? 0 : items.filter((n) => n.at > seen).length;
  const markRead = () => {
    const newest = items.map((n) => n.at).sort().at(-1) ?? "";
    setSeen(newest);
    try {
      window.localStorage.setItem(SEEN_KEY, newest);
    } catch {}
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={unread ? `${t("topbar.notifications")} (${unread})` : t("topbar.notifications")}
        aria-expanded={open}
        aria-haspopup="true"
        className="relative flex size-10 items-center justify-center rounded-full border border-transparent text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
      >
        <Bell className="size-5" />
        {unread > 0 && (
          <span className="absolute top-1.5 right-1.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] leading-4 font-semibold text-white ring-2 ring-background">{unread}</span>
        )}
      </button>
      {open && (
        <div className={cn(POPOVER, "right-0 w-[min(22rem,calc(100vw-2rem))]")}>
          <div className="flex items-center justify-between px-4 py-3">
            <p className="text-sm font-semibold">{t("topbar.notifications")}</p>
            {unread > 0 && (
              <button type="button" onClick={markRead} className="text-xs text-primary underline-offset-2 hover:underline">{t("topbar.markRead")}</button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto border-t">
            {items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">{t("topbar.noNotifications")}</p>
            ) : (
              items.map((n) => (
                <Link key={n.id} href={n.href} onClick={() => setOpen(false)} className="flex gap-3 border-b px-4 py-3 last:border-0 hover:bg-accent/60">
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", TONE[n.tone], seen !== null && n.at <= seen && "opacity-30")} />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{n.title}</span>
                    <span className="block text-xs text-muted-foreground">{n.body}</span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">{timeAgo(n.at)}</span>
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

function Profile({ user, role, workspaceName, canBilling, canManageWorkspace }: {
  user: { name: string | null; email: string };
  role: string;
  workspaceName: string;
  canBilling: boolean;
  canManageWorkspace: boolean;
}) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>("light");
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);
  useEffect(() => {
    const saved = document.documentElement.dataset.theme;
    if (isTheme(saved)) setTheme(saved);
  }, []);
  const initials = initialsOf(user.name, user.email);
  const display = user.name?.trim() || user.email.split("@")[0]!;

  const avatar = (size: string) => (
    <span aria-hidden="true" className={cn("flex shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground select-none", size)}>{initials}</span>
  );
  const item = "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm hover:bg-accent/60";
  const heading = "px-2.5 pt-2 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase";
  const go = (href: string, Icon: typeof UserRound, label: string) => (
    <Link href={href} onClick={() => setOpen(false)} className={item}>
      <Icon className="size-4 text-muted-foreground" /> {label}
    </Link>
  );

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`${t("topbar.profile")}: ${display}`}
        aria-expanded={open}
        aria-haspopup="true"
        className="flex items-center gap-2.5 rounded-full border border-transparent p-0.5 pr-0.5 transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none sm:pr-3"
      >
        {avatar("size-9 text-sm")}
        <span className="hidden min-w-0 text-left sm:block">
          <span className="block max-w-32 truncate text-sm leading-tight font-medium">{display}</span>
          <span className="block text-[11px] leading-tight text-muted-foreground">{t(`settings.roles.${role}`)}</span>
        </span>
      </button>
      {open && (
        <div className={cn(POPOVER, "right-0 max-h-[calc(100dvh-5rem)] w-72 overflow-y-auto p-1.5")}>
          <div className="flex items-center gap-3 px-2.5 py-2.5">
            {avatar("size-11 text-base")}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{display}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              <p className="truncate text-xs text-muted-foreground">{t(`settings.roles.${role}`)} · {workspaceName}</p>
            </div>
          </div>

          <div className="border-t pt-1">
            <p className={heading}>{t("profile.account")}</p>
            {go("/account", UserRound, t("profile.editProfile"))}
            {go("/account/security", ShieldCheck, t("profile.changePassword"))}
            {go("/account#notifications", BellRing, t("profile.notifications"))}
          </div>

          <div className="mt-1 border-t pt-1">
            <p className={heading}>{t("profile.workspace")}</p>
            {canManageWorkspace && go("/settings#workspace", PenLine, t("profile.renameWorkspace"))}
            {go("/settings#members", Users, t("profile.members"))}
            {canBilling && go("/billing", CreditCard, t("profile.billing"))}
            {canBilling && go("/api-keys", KeyRound, t("nav.apiKeys"))}
          </div>

          <div className="mt-1 border-t pt-1">
            <div className="flex items-center justify-between gap-3 px-2.5 py-1.5">
              <span>
                <span className="block text-sm">{t("profile.appearance")}</span>
                <span className="block text-xs text-muted-foreground">{theme === "dark" ? t("profile.theme.dark") : t("profile.theme.light")}</span>
              </span>
              <ThemeSwitch
                night={theme === "dark"}
                label={t("profile.appearance")}
                onChange={(night) => { const next: Theme = night ? "dark" : "light"; applyTheme(next); setTheme(next); }}
              />
            </div>
          </div>

          <div className="mt-1 border-t pt-1">
            <p className={heading}>{t("profile.support")}</p>
            {go("/help", CircleHelp, t("profile.helpCentre"))}
            {go("/help#contact", LifeBuoy, t("profile.contactSupport"))}
            {go("/help#whats-new", Sparkles, t("profile.whatsNew"))}
          </div>

          <div className="mt-1 border-t pt-1">
            <form action={signOut}>
              <button type="submit" className={cn(item, "text-destructive")}><LogOut className="size-4" /> {t("nav.signOut")}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The bar
// ---------------------------------------------------------------------------

export function TopBar({
  user,
  role,
  notifications,
  canBilling,
  canManageWorkspace,
  organisation,
}: {
  user: { name: string | null; email: string };
  role: string;
  notifications: ShellNotification[];
  canBilling: boolean;
  canManageWorkspace: boolean;
  organisation: { id: string; name: string };
}) {
  return (
    <div className="sticky top-[61px] z-20 border-b bg-background/85 backdrop-blur lg:top-0">
      <div className="grid h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 lg:grid-cols-[1fr_minmax(0,36rem)_1fr] lg:px-8">
        {/* Search sits in the middle on wide screens; on phones it takes the free space. */}
        <div className="lg:col-start-2">
          <SearchBox role={role} />
        </div>
        <div className="flex items-center justify-end gap-1 lg:col-start-3">
          <Notifications items={notifications} />
          <Profile user={user} role={role} workspaceName={organisation.name} canBilling={canBilling} canManageWorkspace={canManageWorkspace} />
        </div>
      </div>
    </div>
  );
}
