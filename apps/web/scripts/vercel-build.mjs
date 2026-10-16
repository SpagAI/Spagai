/**
 * Build on Vercel: create or update the database tables, load the sample data on a demo site
 * (DEMO_MODE=true; safe to repeat, it only adds what is missing), then build the website.
 * Database changes use the direct (non-pooled) connection when the host provides one, as Neon does.
 */
import { execSync } from "node:child_process";

const direct = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL;
if (!direct) {
  console.error("DATABASE_URL is not set. Add a Postgres database to the Vercel project first (see README, Deploy to Vercel).");
  process.exit(1);
}

const run = (command, extraEnv = {}) => {
  console.log(`\n> ${command}`);
  execSync(command, { stdio: "inherit", env: { ...process.env, ...extraEnv } });
};

run("prisma generate");
run("prisma migrate deploy", { DATABASE_URL: direct });
if (process.env.DEMO_MODE === "true") run("tsx prisma/seed.ts", { DATABASE_URL: direct });
run("next build");
