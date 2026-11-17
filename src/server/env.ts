/**
 * Validated environment. Import `env` instead of reading process.env directly,
 * so a missing secret fails fast at boot instead of deep inside a request.
 */
import { z } from "zod";

const csv = z
  .string()
  .optional()
  .transform((v) =>
    (v ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  /** postgres://... (Neon pooled URL in prod, docker compose locally). `pglite:memory` is for tests only. */
  DATABASE_URL: z.string().min(1).default("postgres://postgres:postgres@127.0.0.1:5433/dsapod"),
  BETTER_AUTH_SECRET: z.string().min(32).default("dev-only-secret-change-me-dev-only-secret"),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:3000"),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  /** Emails that are made admin on first sign-in. Admins can promote others later. */
  ADMIN_EMAILS: csv,
  /** If set, only these email domains can sign up (e.g. "college.edu"). Empty = any Google account. */
  ALLOWED_EMAIL_DOMAINS: csv,
  /** Resend key for email magic links. Without it, links are printed to the server log (dev only). */
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("DSA POD <no-reply@example.com>"),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHANNEL_ID: z.string().optional(),
  /** Private chat/group for the admin digest. */
  TELEGRAM_ADMIN_CHAT_ID: z.string().optional(),
  DISCORD_WEBHOOK_URL: z.string().url().optional(),
  /** Shared secret for the /api/cron/* endpoints. */
  CRON_SECRET: z.string().min(16).optional(),
  CLIST_API_USERNAME: z.string().optional(),
  CLIST_API_KEY: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment:", z.prettifyError(parsed.error));
  throw new Error("Invalid environment variables");
}

const isBuild = process.env.NEXT_PHASE === "phase-production-build";
if (!isBuild && parsed.data.NODE_ENV === "production" && parsed.data.BETTER_AUTH_SECRET.startsWith("dev-only")) {
  throw new Error("BETTER_AUTH_SECRET must be set in production");
}

export const env = parsed.data;
export const googleEnabled = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
