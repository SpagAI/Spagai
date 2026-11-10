/**
 * Build on Cloudflare (Workers Builds): create or update the database tables, load the sample data on a
 * demo site (DEMO_MODE=true; safe to repeat, it only adds what is missing), then build the Worker.
 * Database changes use the direct (non-pooled) Neon connection when DATABASE_URL_UNPOOLED is set.
 * In Cloudflare these must be added as *build* variables (see README, "Deploy to Cloudflare").
 */
import { execSync } from "node:child_process";

const direct = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!direct) {
  console.error("DATABASE_URL is not set. Add it under Settings → Build → Variables and secrets (see README, Deploy to Cloudflare).");
  process.exit(1);
}

const run = (command, extraEnv = {}) => {
  console.log(`\n> ${command}`);
  execSync(command, { stdio: "inherit", env: { ...process.env, ...extraEnv } });
};

run("pnpm exec prisma generate");
run("pnpm exec prisma migrate deploy", { DATABASE_URL: direct });
if (process.env.DEMO_MODE === "true") run("pnpm exec tsx prisma/seed.ts", { DATABASE_URL: direct });
run("pnpm exec opennextjs-cloudflare build");
