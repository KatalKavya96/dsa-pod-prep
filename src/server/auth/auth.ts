/**
 * Authentication: Google OAuth (primary) + email magic link (fallback).
 *
 * Who is admin is decided by the POD, never by the user:
 *   - ADMIN_EMAILS are made admin on their first sign-in (bootstrap).
 *   - After that, admins promote/demote from /admin/members.
 * `role` is declared with `input: false`, so sign-up payloads cannot set it.
 */
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins";
import { db, schema } from "@/server/db";
import { env, googleEnabled } from "@/server/env";
import { sendEmail } from "@/server/modules/notifications/email";

export function isEmailAllowed(email: string, allowedDomains = env.ALLOWED_EMAIL_DOMAINS): boolean {
  if (allowedDomains.length === 0) return true;
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  return allowedDomains.includes(domain);
}

export function roleForNewUser(email: string, adminEmails = env.ADMIN_EMAILS): "admin" | "member" {
  return adminEmails.includes(email.toLowerCase()) ? "admin" : "member";
}

export const auth = betterAuth({
  appName: "DSA POD",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  socialProviders: googleEnabled
    ? {
        google: {
          clientId: env.GOOGLE_CLIENT_ID!,
          clientSecret: env.GOOGLE_CLIENT_SECRET!,
          prompt: "select_account",
        },
      }
    : {},
  account: { accountLinking: { enabled: true, trustedProviders: ["google"] } },
  user: {
    additionalFields: {
      role: { type: "string", input: false, defaultValue: "member" },
      status: { type: "string", input: false, defaultValue: "active" },
      username: { type: "string", input: false, required: false },
      batch: { type: "string", input: false, required: false },
      onboardedAt: { type: "date", input: false, required: false },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh expiry at most daily
    // Signed session cache in a cookie: most requests never touch the DB for auth.
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  rateLimit: {
    enabled: env.NODE_ENV === "production",
    storage: "database", // shared across serverless instances
    window: 60,
    max: 120,
    customRules: {
      "/sign-in/magic-link": { window: 15 * 60, max: 3 },
      "/sign-in/social": { window: 60, max: 10 },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (u) => {
          if (!isEmailAllowed(u.email)) {
            throw new APIError("FORBIDDEN", { message: "This email domain is not allowed to join." });
          }
          return { data: { ...u, role: roleForNewUser(u.email) } };
        },
      },
    },
  },
  plugins: [
    magicLink({
      expiresIn: 10 * 60,
      sendMagicLink: async ({ email, url }) => {
        if (!isEmailAllowed(email)) {
          throw new APIError("FORBIDDEN", { message: "This email domain is not allowed to join." });
        }
        await sendEmail({
          to: email,
          subject: "Your DSA POD sign-in link",
          html: `<p>Click to sign in to DSA POD (valid 10 minutes):</p><p><a href="${url}">Sign in</a></p><p>If you didn't request this, ignore this email.</p>`,
          devLog: `Magic link for ${email}: ${url}`,
        });
      },
    }),
    nextCookies(), // must stay last
  ],
});

export type AuthSession = typeof auth.$Infer.Session;
