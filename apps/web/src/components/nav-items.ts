import { AudioLines, House, BookOpen, Bot, CreditCard, FlaskConical, KeyRound, LayoutDashboard, ListChecks, Megaphone, Phone, PhoneCall, Plug, Settings } from "lucide-react";

export interface NavItem {
  href: string;
  key: string;
  icon: typeof Bot;
  /** Only these roles see the item. */
  roles?: string[];
}

export const NAV: NavItem[] = [
  { href: "/home", key: "home", icon: House },
  { href: "/dashboard", key: "dashboard", icon: LayoutDashboard },
  { href: "/agents", key: "agents", icon: Bot },
  { href: "/voices", key: "voices", icon: AudioLines },
  { href: "/knowledge", key: "knowledge", icon: BookOpen },
  { href: "/numbers", key: "numbers", icon: Phone },
  { href: "/lab", key: "simulator", icon: FlaskConical },
  { href: "/leads", key: "leads", icon: ListChecks },
  { href: "/campaigns", key: "campaigns", icon: Megaphone },
  { href: "/calls", key: "calls", icon: PhoneCall },
  { href: "/integrations", key: "integrations", icon: Plug },
  { href: "/api-keys", key: "apiKeys", icon: KeyRound, roles: ["OWNER", "ADMIN"] },
  { href: "/billing", key: "billing", icon: CreditCard, roles: ["OWNER", "ADMIN"] },
  { href: "/settings", key: "settings", icon: Settings },
];

export const navFor = (role: string) => NAV.filter((item) => !item.roles || item.roles.includes(role));
