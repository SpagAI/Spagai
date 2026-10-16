/** Data the app shell (side panel and top bar) needs. Plain objects, safe to pass to client components. */

export interface WalletSummary {
  balanceKobo: number;
  ratePerMinuteKobo: number;
  /** Everything ever added to the wallet (top-ups and credits), in kobo. The bar shows balance out of this. */
  totalCreditedKobo: number;
}

export interface ShellNotification {
  id: string;
  title: string;
  body: string;
  href: string;
  /** ISO time the notification refers to. */
  at: string;
  tone: "info" | "warning" | "success";
}

export interface SearchHit {
  key: string;
  group: "agents" | "leads" | "campaigns";
  label: string;
  sub: string;
  href: string;
}

/** Share of credit left, 0 to 100 (whole numbers). 0 when nothing has been added yet. */
export function creditPercentLeft(w: Pick<WalletSummary, "balanceKobo" | "totalCreditedKobo">): number {
  if (w.totalCreditedKobo <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((w.balanceKobo / w.totalCreditedKobo) * 100)));
}

/** Up to two letters for the circular profile picture: "Demo Owner" gives "DO". */
export function initialsOf(name: string | null, email: string): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0]![0]! + words[1]![0]!).toUpperCase();
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (email[0] ?? "?").toUpperCase();
}
