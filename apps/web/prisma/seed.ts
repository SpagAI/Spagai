/**
 * Demo data: one organisation, an owner (demo@spagai.local), a viewer, and one agent.
 * Run with: pnpm db:seed   then sign in as demo@spagai.local.
 */
import { getPreset, presetToAgentConfig } from "@spagai/core";
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
    await db.agent.create({ data: { organisationId: org.id, name: config.name, presetId: preset.id, config, createdById: owner.id } });
  }
  console.log(`Seeded "${org.name}". Sign in as demo@spagai.local (owner) or viewer@spagai.local (viewer).`);
}

main().finally(() => db.$disconnect());
