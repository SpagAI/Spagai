"use client";

import { formatNaira, minutesCovered } from "@spagai/core";
import { Menu, PanelLeftClose, Wallet, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { navFor } from "@/components/nav-items";
import { SpagLogo } from "@/components/spag-logo";
import { NavigationLoader } from "@/components/navigation-loader";
import { TopBar } from "@/components/top-bar";
import { WorkspaceSwitcher, type WorkspaceOption } from "@/components/workspace-switcher";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n/client";
import { creditPercentLeft, type ShellNotification, type WalletSummary } from "@/lib/shell-types";
import { cn } from "@/lib/utils";

/** Side panel width limits (px). Dragging narrower than SNAP_BELOW collapses it to icons only. */
const DEFAULT_WIDTH = 240;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;
const SNAP_BELOW = 150;
const COLLAPSED_WIDTH = 64;
const STORAGE_KEY = "spag.sidebar";

const clamp = (w: number) => Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(w)));

/** The credit bar turns amber below 25% and red below 10%. */
const barColour = (pct: number) => (pct < 10 ? "bg-destructive" : pct < 25 ? "bg-warning" : "bg-primary");

export interface ShellProps {
  children: ReactNode;
  user: { email: string; name: string | null };
  organisation: { id: string; name: string };
  role: string;
  /** Every workspace this person belongs to (for the switcher). */
  workspaces: WorkspaceOption[];
  wallet: WalletSummary;
  notifications: ShellNotification[];
  /** Owners and admins can open Billing and buy credit. */
  canBilling: boolean;
  /** Owners and admins can invite members from the switcher. */
  canInvite: boolean;
}

export function AppShell({ children, user, organisation, role, workspaces, wallet, notifications, canBilling, canInvite }: ShellProps) {
  const t = useT();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [collapsed, setCollapsed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ x: number; width: number } | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const panelScroll = useRef<HTMLDivElement>(null);

  // The mouse wheel scrolls the side panel wherever the pointer is on it (logo, workspace,
  // menu or credit box), and never scrolls the page behind it.
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return; // pinch-zoom
      const list = panelScroll.current;
      e.preventDefault();
      if (!list) return;
      // Inside the list the browser would scroll it anyway; doing it here keeps one behaviour everywhere.
      list.scrollTop += e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    };
    panel.addEventListener("wheel", onWheel, { passive: false });
    return () => panel.removeEventListener("wheel", onWheel);
  }, []);

  // Remember each person's panel size on this browser. Storage can be unavailable; the defaults then apply.
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null") as { width?: number; collapsed?: boolean } | null;
      if (typeof saved?.width === "number") setWidth(clamp(saved.width));
      if (typeof saved?.collapsed === "boolean") setCollapsed(saved.collapsed);
    } catch {}
  }, []);
  const save = useCallback((next: { width: number; collapsed: boolean }) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
  }, []);

  const toggle = () => {
    setCollapsed((c) => {
      save({ width, collapsed: !c });
      return !c;
    });
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStart.current = { x: e.clientX, width: collapsed ? COLLAPSED_WIDTH : width };
    setDragging(true);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragStart.current) return;
    const next = dragStart.current.width + e.clientX - dragStart.current.x;
    if (next < SNAP_BELOW) setCollapsed(true);
    else {
      setCollapsed(false);
      setWidth(clamp(next));
    }
  };
  const onPointerUp = () => {
    if (!dragStart.current) return;
    dragStart.current = null;
    setDragging(false);
    save({ width, collapsed });
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 48 : 16;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const next = clamp((collapsed ? MIN_WIDTH : width) + (e.key === "ArrowRight" ? step : -step));
      setCollapsed(false);
      setWidth(next);
      save({ width: next, collapsed: false });
    } else if (e.key === "Enter") {
      e.preventDefault();
      toggle();
    }
  };

  const items = navFor(role);
  const nav = (compact: boolean) => (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        const label = t(`nav.${item.key}`);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            title={compact ? label : undefined}
            aria-label={compact ? label : undefined}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-9 items-center gap-3 rounded-md text-sm transition-colors",
              compact ? "justify-center px-0" : "px-3",
              active
                ? "bg-sidebar-accent font-semibold text-sidebar-foreground"
                : "text-sidebar-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            {!compact && <span className="flex-1 truncate">{label}</span>}
          </Link>
        );
      })}
    </nav>
  );

  const currentWorkspace = workspaces.find((w) => w.id === organisation.id) ?? workspaces[0]!;
  const workspaceSwitcher = (compact: boolean) => (
    <WorkspaceSwitcher current={currentWorkspace} options={workspaces} canInvite={canInvite} compact={compact} onNavigate={() => setOpen(false)} />
  );

  const pct = creditPercentLeft(wallet);
  const credit = (compact: boolean) => {
    const left = formatNaira(wallet.balanceKobo);
    const summary = t("credit.summary").replace("{amount}", left).replace("{percent}", String(pct));
    if (compact) {
      const mini = (
        <>
          <Wallet className="size-4" />
          <span className="h-1 w-6 overflow-hidden rounded-full bg-sidebar-border">
            <span className={cn("block h-full rounded-full", barColour(pct))} style={{ width: `${pct}%` }} />
          </span>
        </>
      );
      const cls = "mx-auto flex h-11 w-10 flex-col items-center justify-center gap-1.5 rounded-md text-sidebar-muted-foreground";
      return canBilling ? (
        <Link href="/billing" title={summary} aria-label={summary} className={cn(cls, "hover:bg-sidebar-accent hover:text-sidebar-foreground")}>{mini}</Link>
      ) : (
        <div title={summary} aria-label={summary} role="img" className={cls}>{mini}</div>
      );
    }
    return (
      <div className="rounded-xl border border-sidebar-border bg-white/70 p-3 dark:bg-black/20">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-sidebar-muted-foreground">{t("credit.title")}</span>
          <span className="truncate rounded-full bg-sidebar-accent px-2 py-0.5 text-[10px] font-semibold text-sidebar-foreground" title={t("credit.paygHelp")}>{t("credit.payg")}</span>
        </div>
        <p className="mt-1.5 flex items-baseline justify-between gap-2">
          <span className="text-xl font-semibold tracking-tight text-sidebar-foreground tabular-nums">{left}</span>
          <span className="shrink-0 text-xs font-medium text-sidebar-muted-foreground tabular-nums">{t("credit.left").replace("{percent}", String(pct))}</span>
        </p>
        <div
          role="progressbar"
          aria-label={t("credit.title")}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-valuetext={summary}
          className="mt-2 h-2 overflow-hidden rounded-full bg-sidebar-border"
        >
          <div className={cn("h-full rounded-full transition-[width] duration-500", barColour(pct))} style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-1.5 text-left text-[11px] leading-snug text-sidebar-muted-foreground">
          {wallet.totalCreditedKobo > 0
            ? t("credit.detail")
                .replace("{minutes}", String(minutesCovered(wallet.balanceKobo, wallet.ratePerMinuteKobo)))
            : t("credit.none")}
        </p>
        {canBilling ? (
          <Button asChild size="sm" className="mt-3 w-full">
            <Link href="/billing" onClick={() => setOpen(false)}>{t("credit.buy")}</Link>
          </Button>
        ) : (
          <p className="mt-2 text-[11px] text-sidebar-muted-foreground">{t("credit.askAdmin")}</p>
        )}
      </div>
    );
  };

  const panelWidth = collapsed ? COLLAPSED_WIDTH : width;

  return (
    <div
      className={cn(
        "min-h-dvh lg:grid lg:grid-cols-[var(--sidebar-width)_minmax(0,1fr)]",
        // Smooth open and close; no animation while dragging, so resizing follows the pointer.
        !dragging && "lg:transition-[grid-template-columns] lg:duration-200 lg:ease-out",
      )}
      style={{ "--sidebar-width": `${panelWidth}px` } as CSSProperties}
    >
      {/* Desktop side panel */}
      <aside
        ref={panelRef}
        className={cn(
          "sticky top-0 hidden h-dvh flex-col gap-6 border-r border-sidebar-border bg-sidebar py-4 text-sidebar-foreground lg:flex",
          // Same side padding open and collapsed (12 + 40 + 12 = 64px), so the logo and the
          // nav icons never move or change size when the panel opens or closes.
          "overflow-hidden px-3",
        )}
      >
        <div className="flex h-10 items-center">
          {/* The logo sits in a fixed 40px box at a fixed size, open or collapsed. */}
          {collapsed ? (
            <button
              type="button"
              onClick={toggle}
              aria-label={t("nav.expand")}
              aria-expanded={false}
              title={t("nav.expand")}
              className="flex size-10 shrink-0 items-center justify-center rounded-md text-sidebar-foreground hover:bg-sidebar-accent"
            >
              <SpagLogo className="h-[30.6px]" title={t("app.brand")} />
            </button>
          ) : (
            <>
              <Link href="/dashboard" className="flex size-10 shrink-0 items-center justify-center" aria-label={t("app.brand")}>
                <SpagLogo className="h-[30.6px]" title="" />
              </Link>
              {/* Pulled left into the logo box's empty edge, so the name sits right next to the mark (the logo itself never moves),
                  and 1px down so the capitals centre on the mark, whose right-hand curves sit low. */}
              <Link href="/dashboard" className="-ml-1.5 min-w-0 flex-1 translate-y-px truncate pr-2 text-lg font-semibold tracking-tight">{t("app.brand")}</Link>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 text-sidebar-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
                onClick={toggle}
                aria-label={t("nav.collapse")}
                aria-expanded
                title={t("nav.collapse")}
              >
                <PanelLeftClose />
              </Button>
            </>
          )}
        </div>
        {/* Collapsed: no scrollbar at all. Open: an extra-faint one while scrolling (see .sidebar-scroll). */}
        <div ref={panelScroll} className={cn("-mt-2 flex-1 space-y-2 overflow-y-auto overflow-x-hidden overscroll-contain", collapsed ? "no-scrollbar" : "sidebar-scroll")}>
          {workspaceSwitcher(collapsed)}
          {nav(collapsed)}
        </div>
        <div className="border-t border-sidebar-border pt-4">{credit(collapsed)}</div>

        {/* Drag handle on the right edge: drag to resize, or use the arrow keys. */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label={t("nav.resize")}
          aria-valuemin={COLLAPSED_WIDTH}
          aria-valuemax={MAX_WIDTH}
          aria-valuenow={panelWidth}
          tabIndex={0}
          title={t("nav.resize")}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={() => {
            setCollapsed(false);
            setWidth(DEFAULT_WIDTH);
            save({ width: DEFAULT_WIDTH, collapsed: false });
          }}
          onKeyDown={onKeyDown}
          className={cn(
            "absolute top-0 right-0 z-10 h-full w-2 cursor-col-resize touch-none outline-none",
            "after:absolute after:inset-y-0 after:right-0 after:w-0.5 after:rounded-full after:transition-colors",
            dragging ? "after:bg-primary" : "hover:after:bg-primary/50 focus-visible:after:bg-primary",
          )}
        />
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-sidebar-border bg-sidebar/95 px-4 py-3 text-sidebar-foreground backdrop-blur lg:hidden">
        <Link href="/dashboard" className="flex min-w-0 items-center gap-2 font-semibold">
          <SpagLogo className="h-8" title="" />
          <span className="truncate">{t("app.brand")}</span>
        </Link>
        <Button variant="ghost" size="icon" aria-label={t("nav.menu")} aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? <X /> : <Menu />}
        </Button>
      </header>
      {open && (
        <div className="fixed inset-x-0 top-[61px] bottom-0 z-20 flex flex-col gap-4 overflow-y-auto bg-sidebar p-4 text-sidebar-foreground lg:hidden">
          {workspaceSwitcher(false)}
          {nav(false)}
          <div className="border-t border-sidebar-border pt-4">{credit(false)}</div>
        </div>
      )}

      <div className="min-w-0">
        <TopBar user={user} role={role} notifications={notifications} canBilling={canBilling} canManageWorkspace={canInvite} organisation={organisation} />
        <main className={cn("relative min-h-[calc(100dvh-4rem)] px-4 py-6 lg:px-8 lg:py-8", dragging && "select-none")}>
          {children}
          <Suspense fallback={null}><NavigationLoader /></Suspense>
        </main>
      </div>
    </div>
  );
}
