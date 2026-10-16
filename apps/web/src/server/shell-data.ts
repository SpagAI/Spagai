import "server-only";
import { formatNaira } from "@spagai/core";
import type { ShellNotification, WalletSummary } from "@/lib/shell-types";
import { db } from "./db";
import { can, type Role } from "./permissions";

const DAY = 24 * 60 * 60 * 1000;

export async function loadWallet(organisationId: string): Promise<WalletSummary> {
  const [org, credited] = await Promise.all([
    db.organisation.findUniqueOrThrow({ where: { id: organisationId }, select: { balanceKobo: true, ratePerMinuteKobo: true } }),
    db.walletTransaction.aggregate({
      where: { organisationId, status: "SUCCESS", amountKobo: { gt: 0 } },
      _sum: { amountKobo: true },
    }),
  ]);
  return { balanceKobo: org.balanceKobo, ratePerMinuteKobo: org.ratePerMinuteKobo, totalCreditedKobo: credited._sum.amountKobo ?? 0 };
}

/**
 * Notifications are worked out from what happened in the last 7 days (there is no separate
 * notifications table yet). Which ones a person sees depends on their role.
 */
export async function loadNotifications(organisationId: string, role: Role, wallet: WalletSummary): Promise<ShellNotification[]> {
  const since = new Date(Date.now() - 7 * DAY);
  const org = { organisationId };
  const [finished, optedOut, blocked, lastMoney] = await Promise.all([
    db.campaign.findMany({ where: { ...org, status: "COMPLETED", updatedAt: { gte: since } }, select: { id: true, name: true, updatedAt: true }, orderBy: { updatedAt: "desc" }, take: 3 }),
    db.lead.aggregate({ where: { ...org, optedOutAt: { gte: since } }, _count: true, _max: { optedOutAt: true } }),
    db.call.aggregate({ where: { ...org, status: "BLOCKED", createdAt: { gte: since } }, _count: true, _max: { createdAt: true } }),
    db.walletTransaction.findFirst({ where: org, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
  ]);

  const list: ShellNotification[] = [];
  if (can(role, "billing:view") && wallet.balanceKobo < wallet.ratePerMinuteKobo * 10) {
    list.push({
      id: "low-balance",
      title: "Credit is running low",
      body: `${formatNaira(wallet.balanceKobo)} left. Campaigns stop when it cannot cover one more minute.`,
      href: "/billing",
      at: (lastMoney?.createdAt ?? new Date()).toISOString(),
      tone: "warning",
    });
  }
  for (const c of finished) {
    list.push({ id: `campaign-${c.id}`, title: "Campaign finished", body: c.name, href: `/campaigns/${c.id}`, at: c.updatedAt.toISOString(), tone: "success" });
  }
  if (optedOut._count > 0 && optedOut._max.optedOutAt) {
    list.push({
      id: `optouts-${optedOut._max.optedOutAt.getTime()}`,
      title: optedOut._count === 1 ? "1 person asked not to be called" : `${optedOut._count} people asked not to be called`,
      body: "They are on the do-not-call list and will not be called again.",
      href: "/leads",
      at: optedOut._max.optedOutAt.toISOString(),
      tone: "info",
    });
  }
  if (blocked._count > 0 && blocked._max.createdAt) {
    list.push({
      id: `blocked-${blocked._max.createdAt.getTime()}`,
      title: blocked._count === 1 ? "1 call was blocked by the rules" : `${blocked._count} calls were blocked by the rules`,
      body: "See the reasons in the calls log.",
      href: "/calls?status=BLOCKED",
      at: blocked._max.createdAt.toISOString(),
      tone: "info",
    });
  }
  return list.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8);
}
