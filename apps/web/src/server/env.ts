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
  /** Development only: show the sign-in link on the page after requesting it. Refused in production. */
  DEV_SHOW_LOGIN_LINK: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  /** Who writes the agent's replies in the simulator. "mock" is free and needs no key. */
  LLM_PROVIDER: z.enum(["mock", "openai_compatible"]).default("mock"),
  /** Who speaks voice previews. "mock" uses the browser's built-in speech. */
  TTS_PROVIDER: z.enum(["mock", "openai_compatible"]).default("mock"),
  /** Who places phone calls. Only "mock" works in this prototype (see docs/DEVELOPER_HANDOFF.md). */
  TELEPHONY_PROVIDER: z.enum(["mock"]).default("mock"),
  /** Who takes wallet top-up payments. "mock" shows a pretend checkout page. */
  PAYMENTS_PROVIDER: z.enum(["mock", "paystack"]).default("mock"),
  PAYSTACK_SECRET_KEY: z.string().optional(),
  /** Shared secret the voice worker sends when calling this app's /api/voice/* endpoints. */
  WORKER_SHARED_SECRET: z
    .string()
    .optional()
    .transform((v) => v || undefined),
  OPENAI_COMPATIBLE_BASE_URL: z.string().url().optional().or(z.literal("").transform(() => undefined)),
  OPENAI_COMPATIBLE_API_KEY: z.string().optional(),
  OPENAI_COMPATIBLE_MODEL: z.string().optional(),
  OPENAI_COMPATIBLE_TTS_MODEL: z.string().optional(),
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

if (env.NODE_ENV === "production" && env.DEV_SHOW_LOGIN_LINK) {
  throw new Error("DEV_SHOW_LOGIN_LINK must not be enabled in production.");
}

if (env.LLM_PROVIDER === "openai_compatible" && !(env.OPENAI_COMPATIBLE_BASE_URL && env.OPENAI_COMPATIBLE_MODEL)) {
  throw new Error("LLM_PROVIDER=openai_compatible needs OPENAI_COMPATIBLE_BASE_URL and OPENAI_COMPATIBLE_MODEL.");
}

if (env.TTS_PROVIDER === "openai_compatible" && !(env.OPENAI_COMPATIBLE_BASE_URL && env.OPENAI_COMPATIBLE_TTS_MODEL)) {
  throw new Error("TTS_PROVIDER=openai_compatible needs OPENAI_COMPATIBLE_BASE_URL and OPENAI_COMPATIBLE_TTS_MODEL.");
}

if (env.PAYMENTS_PROVIDER === "paystack" && !env.PAYSTACK_SECRET_KEY?.startsWith("sk_")) {
  throw new Error("PAYMENTS_PROVIDER=paystack needs PAYSTACK_SECRET_KEY (it starts with sk_).");
}

if (env.NODE_ENV === "production" && env.PAYMENTS_PROVIDER === "mock") {
  throw new Error("The pretend checkout must not run in production. Set PAYMENTS_PROVIDER=paystack.");
}

if (env.WORKER_SHARED_SECRET !== undefined && env.WORKER_SHARED_SECRET.length < 32) {
  throw new Error("WORKER_SHARED_SECRET must be at least 32 characters.");
}

if (env.NODE_ENV === "production" && env.SESSION_SECRET.startsWith("dev-only")) {
  throw new Error("SESSION_SECRET must be set in production.");
}
