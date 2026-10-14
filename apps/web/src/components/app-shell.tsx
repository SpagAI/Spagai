"use client";

import {
  AudioLines,
  Bot,
  CreditCard,
  FlaskConical,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Megaphone,
  Menu,
  PhoneCall,
  Settings,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { signOut, switchOrganisation } from "@/app/(app)/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useT } from "@/i18n/client";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  key: string;
  icon: typeof Bot;
  soon?: string;
  /** Only these roles see the item. */
  roles?: string[];
}

const NAV: NavItem[] = [
  { href: "/dashboard", key: "dashboard", icon: LayoutDashboard },
  { href: "/agents", key: "agents", icon: Bot },
  { href: "/voices", key: "voices", icon: AudioLines },
  { href: "/simulator", key: "simulator", icon: FlaskConical },
  { href: "/leads", key: "leads", icon: ListChecks },
  { href: "/campaigns", key: "campaigns", icon: Megaphone },
  { href: "/calls", key: "calls", icon: PhoneCall },
  { href: "/billing", key: "billing", icon: CreditCard, roles: ["OWNER", "ADMIN"] },
  { href: "/settings", key: "settings", icon: Settings },
];

export interface ShellProps {
  children: ReactNode;
  user: { email: string };
  organisation: { id: string; name: string };
  role: string;
  memberships: { organisationId: string; organisationName: string }[];
}

export function AppShell({ children, user, organisation, role, memberships }: ShellProps) {
  const t = useT();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const nav = (
    <nav className="flex flex-col gap-1">
      {NAV.filter((item) => !item.roles || item.roles.includes(role)).map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              active ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            <span className="flex-1">{t(`nav.${item.key}`)}</span>
            {item.soon && <Badge variant="outline" className="text-[10px] text-muted-foreground">{item.soon}</Badge>}
          </Link>
        );
      })}
    </nav>
  );

  const footer = (
    <div className="space-y-3 border-t pt-4 text-sm">
      {memberships.length > 1 ? (
        <form action={switchOrganisation} className="space-y-1">
          <label className="text-xs text-muted-foreground" htmlFor="org-switch">{t("nav.organisation")}</label>
          <Select id="org-switch" name="organisationId" defaultValue={organisation.id} onChange={(e) => e.currentTarget.form?.requestSubmit()}>
            {memberships.map((m) => (
              <option key={m.organisationId} value={m.organisationId}>{m.organisationName}</option>
            ))}
          </Select>
        </form>
      ) : (
        <p className="font-medium">{organisation.name}</p>
      )}
      <p className="truncate text-xs text-muted-foreground">{user.email} · {role.toLowerCase()}</p>
      <form action={signOut}>
        <Button type="submit" variant="ghost" size="sm" className="w-full justify-start px-2">
          <LogOut /> {t("nav.signOut")}
        </Button>
      </form>
    </div>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[240px_1fr]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-r bg-card p-4 lg:flex">
        <Link href="/dashboard" className="px-3 text-lg font-semibold tracking-tight">{t("app.name")}</Link>
        <div className="flex-1 overflow-y-auto">{nav}</div>
        {footer}
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-card/95 px-4 py-3 backdrop-blur lg:hidden">
        <Link href="/dashboard" className="font-semibold">{t("app.name")}</Link>
        <Button variant="ghost" size="icon" aria-label={t("nav.menu")} aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? <X /> : <Menu />}
        </Button>
      </header>
      {open && (
        <div className="fixed inset-x-0 top-[57px] bottom-0 z-20 flex flex-col gap-4 overflow-y-auto bg-card p-4 lg:hidden">
          {nav}
          {footer}
        </div>
      )}

      <main className="min-w-0 px-4 py-6 lg:px-8 lg:py-8">{children}</main>
    </div>
  );
}
