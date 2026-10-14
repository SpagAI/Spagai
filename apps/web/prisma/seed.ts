/**
 * Demo data: one organisation, an owner (demo@spagai.local), a viewer, one agent, ten leads and a ₦10,000 demo wallet credit.
 * Run with: pnpm db:seed   then sign in as demo@spagai.local.
 */
import { agentReadiness, getPreset, presetToAgentConfig } from "@spagai/core";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const owner = await db.user.upsert({ where: { email: "demo@spagai.local" }, create: { email: "demo@spagai.local", name: "Demo Owner" }, update: {} });
  const viewer = await db.user.upsert({ where: { email: "viewer@spagai.local" }, create: { email: "viewer@spagai.local", name: "Demo Viewer" }, update: {} });

  const existing = await db.membership.findFirst({ where: { userId: owner.id }, include: { organisation: true } });
  const org = existing?.organisation ?? (await db.organisation.create({ data: { name: "Spag Demo Finance" } }));

  await db.membership.upsert({
    where: { userId_organisationId: { userId: owner.id, organisationId: org.id } },
    create: { userId: owner.id, organisationId: org.id, role: "OWNER" },
    update: {},
  });
  await db.membership.upsert({
    where: { userId_organisationId: { userId: viewer.id, organisationId: org.id } },
    create: { userId: viewer.id, organisationId: org.id, role: "VIEWER" },
    update: {},
  });

  if ((await db.agent.count({ where: { organisationId: org.id } })) === 0) {
    const preset = getPreset("fintech-outbound-zara")!;
    const config = presetToAgentConfig(preset);
    config.variableValues = {
      ...config.variableValues,
      company_name: "Spag Demo Finance",
      product_name: "business account",
      product_benefit: "you get paid instantly and see every transaction in one app",
    };
    config.voiceId = "mock-en-ng-female-1";
    const status = agentReadiness(config).ready ? "READY" : "DRAFT";
    await db.agent.create({ data: { organisationId: org.id, name: config.name, presetId: preset.id, config, status, createdById: owner.id } });
  }

  // M4 demo leads: a mix of people who can be called, one without consent, and one who already opted out.
  const leads = [
    { firstName: "Chinedu", lastName: "Okafor", gender: "male", phone: "+2348031234501", source: "Website form", consent: true },
    { firstName: "Amaka", lastName: "Eze", title: "Dr", gender: "female", phone: "+2348091234502", source: "Website form", consent: true },
    { firstName: "Tunde", lastName: "Bakare", gender: "male", phone: "+2347031234503", source: "Lagos trade fair", consent: true },
    { firstName: "Ngozi", lastName: "Adeyemi", gender: "female", phone: "+2348131234504", source: "Lagos trade fair", consent: true },
    { firstName: "Ibrahim", lastName: "Musa", title: "Alhaji", gender: "male", phone: "+2349031234505", source: "Referral", consent: true },
    { firstName: "Funmi", lastName: "Oladipo", gender: "female", phone: "+2348051234506", source: "Website form", consent: true },
    { firstName: "Emeka", lastName: "Nwosu", title: "Engr", gender: "male", phone: "+2349131234507", source: "Referral", consent: true },
    { firstName: "Zainab", lastName: "Bello", gender: "female", phone: "+2348061234508", source: "Website form", consent: true },
    { firstName: "Segun", lastName: "Afolabi", gender: "male", phone: "+2347061234509", source: "Lagos trade fair", consent: false },
    { firstName: "Blessing", lastName: "Okon", gender: "female", phone: "+2348171234510", source: "Website form", consent: true, optedOut: true },
  ];
  for (const lead of leads) {
    await db.lead.upsert({
      where: { organisationId_phone: { organisationId: org.id, phone: lead.phone } },
      create: { organisationId: org.id, ...lead, ...(lead.optedOut && { optedOutAt: new Date() }) },
      update: {},
    });
  }
  await db.doNotCall.upsert({
    where: { organisationId_phone: { organisationId: org.id, phone: "+2348171234510" } },
    create: { organisationId: org.id, phone: "+2348171234510", reason: "opt_out", note: "Demo: asked not to be called." },
    update: {},
  });
  // M5: a ₦10,000 demo credit in the wallet (once), so campaigns can run straight away.
  if ((await db.walletTransaction.count({ where: { organisationId: org.id } })) === 0) {
    const credit = 1_000_000;
    const updated = await db.organisation.update({ where: { id: org.id }, data: { balanceKobo: { increment: credit } } });
    await db.walletTransaction.create({
      data: {
        organisationId: org.id, type: "ADJUSTMENT", amountKobo: credit, balanceAfterKobo: updated.balanceKobo,
        reference: `spag_adj_demo_${org.id}`, provider: "manual", description: "Demo credit", completedAt: new Date(),
      },
    });
  }

  console.log(`Seeded "${org.name}". Sign in as demo@spagai.local (owner) or viewer@spagai.local (viewer).`);
}

main().finally(() => db.$disconnect());
