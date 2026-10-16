"use client";

import { Check, ChevronsUpDown, Send, UserPlus } from "lucide-react";
import { useActionState, useCallback, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { switchOrganisation } from "@/app/(app)/actions";
import { inviteFromSwitcher, type SwitcherInviteState } from "@/app/(app)/workspace-actions";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { useDismiss } from "./use-dismiss";
import { WorkspaceBadge } from "./workspace-badge";

export interface WorkspaceOption {
  id: string;
  name: string;
  /** First initial of the owner's first name. */
  letter: string;
  ownerFirstName: string;
  role: string;
}

/**
 * The "Workspace" item at the top of the side panel: shows the current workspace, and opens a box to
 * switch to another workspace or invite a member. The box is placed with fixed positioning so the
 * side panel (which clips its contents) never cuts it off, and it is rendered at the end of the page
 * (a portal) so it always sits in front of everything else, including the dashboard banner.
 */
export function WorkspaceSwitcher({ current, options, canInvite, compact, onNavigate }: {
  current: WorkspaceOption;
  options: WorkspaceOption[];
  canInvite: boolean;
  compact: boolean;
  onNavigate?: () => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  // The invite fields stay hidden until "Add to workspace" is clicked.
  const [adding, setAdding] = useState(false);
  const [pos, setPos] = useState<CSSProperties>({});
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const close = useCallback(() => { setOpen(false); setAdding(false); }, []);
  useDismiss([trigger, panel], open, close);
  const [invite, inviteAction, sending] = useActionState<SwitcherInviteState, FormData>(inviteFromSwitcher, { status: "idle" });
  const roleLabel = (r: string) => t(`settings.roles.${r}`);

  // Place the box next to the trigger: below it when the panel is open, to the right when collapsed.
  useLayoutEffect(() => {
    if (!open || !trigger.current) return;
    const place = () => {
      const r = trigger.current!.getBoundingClientRect(), width = 300;
      const left = compact ? r.right + 8 : Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
      const top = compact ? r.top : r.bottom + 6;
      setPos({ position: "fixed", top, left, width, maxHeight: `calc(100dvh - ${top + 12}px)` });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open, compact]);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        onClick={() => { setOpen((o) => !o); setAdding(false); }}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${t("workspace.label")}: ${current.name}`}
        title={compact ? current.name : undefined}
        className={cn(
          "flex w-full items-center rounded-lg text-left transition-colors hover:bg-sidebar-accent/70 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
          compact ? "h-11 justify-center" : "h-12 gap-2 pr-2",
          open && "bg-sidebar-accent",
        )}
      >
        <span className="flex size-10 shrink-0 items-center justify-center">
          <WorkspaceBadge letter={current.letter} />
        </span>
        {!compact && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm leading-snug font-semibold text-sidebar-foreground">{current.name}</span>
            </span>
            <ChevronsUpDown className="size-4 shrink-0 text-sidebar-muted-foreground" />
          </>
        )}
      </button>

      {open && createPortal(
        <div ref={panel} role="dialog" aria-label={t("workspace.switchTo")} style={pos} className="z-[100] overflow-y-auto rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-xl">
          <p className="px-2.5 pt-1.5 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{t("workspace.switchTo")}</p>
          <ul className="space-y-0.5">
            {options.map((o) => {
              const isCurrent = o.id === current.id;
              return (
                <li key={o.id}>
                  <form action={switchOrganisation} onSubmit={() => { setOpen(false); onNavigate?.(); }}>
                    <input type="hidden" name="organisationId" value={o.id} />
                    <button
                      type="submit"
                      disabled={isCurrent}
                      className={cn("flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left", isCurrent ? "bg-accent/70" : "hover:bg-accent/60")}
                    >
                      <WorkspaceBadge letter={o.letter} className="size-6" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{o.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {roleLabel(o.role)} · {t("workspace.ownedBy").replace("{name}", o.ownerFirstName)}
                        </span>
                      </span>
                      {isCurrent && <Check className="size-4 text-primary" aria-label={t("workspace.current")} />}
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>

          <div className="mt-1.5 border-t px-1 pt-1.5 pb-0.5">
            {canInvite && !adding && (
              <button type="button" onClick={() => setAdding(true)} className="flex w-full items-center gap-2 rounded-lg px-1.5 py-2 text-sm font-medium hover:bg-accent/60">
                <UserPlus className="size-4 text-primary" /> {t("workspace.add")}
              </button>
            )}
            {canInvite && adding && (
              <form action={inviteAction} className="space-y-2 px-1.5 pt-1 pb-1">
                <p className="text-sm font-medium">{t("workspace.invite")}</p>
                <p className="text-xs text-muted-foreground">{t("workspace.inviteHelp")}</p>
                <input
                  name="email"
                  type="email"
                  required
                  maxLength={254}
                  autoFocus
                  placeholder="name@company.com"
                  aria-label={t("workspace.email")}
                  className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
                />
                <div className="flex gap-2">
                  <select name="role" defaultValue="MEMBER" aria-label={t("workspace.role")} className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40">
                    {["ADMIN", "MEMBER", "VIEWER"].map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
                  </select>
                  <Button type="submit" size="sm" className="h-9" disabled={sending}>
                    <Send /> {sending ? t("workspace.sending") : t("workspace.send")}
                  </Button>
                </div>
                {invite.status === "sent" && <p className="text-xs text-primary" role="status">{t("workspace.sent").replace("{email}", invite.email)}</p>}
                {invite.status === "error" && <p className="text-xs text-destructive" role="alert">{invite.message}</p>}
              </form>
            )}
            {!canInvite && <p className="px-1.5 py-1.5 text-xs text-muted-foreground">{t("workspace.noPermission")}</p>}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
