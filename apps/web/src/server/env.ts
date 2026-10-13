import "server-only";
import { z } from "zod";

/** All server settings, checked once at start-up. See .env.example. */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(16).default("dev-only-insecure-secret-change-me"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  EMAIL_FROM: z.string().default("Spag AI Studio <no-reply@spagai.local>"),
  /** "smtp" sends real email (Mailpit locally). "console" prints emails to the terminal (localhost only). */
  EMAIL_TRANSPORT: z.enum(["smtp", "console"]).optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`Invalid environment settings:\n${parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n")}`);
}

const data = parsed.data;
export const env = {
  ...data,
  EMAIL_TRANSPORT: data.EMAIL_TRANSPORT ?? (data.SMTP_HOST ? "smtp" : "console"),
};

const isLocalhost = ["localhost", "127.0.0.1"].includes(new URL(env.APP_URL).hostname);
if (env.EMAIL_TRANSPORT === "console" && !isLocalhost) {
  throw new Error("EMAIL_TRANSPORT=console is only allowed when APP_URL is localhost. Configure SMTP.");
}

if (env.NODE_ENV === "production" && env.SESSION_SECRET.startsWith("dev-only")) {
  throw new Error("SESSION_SECRET must be set in production.");
}
