/**
 * Authorization guards. Every page, server action and route handler that
 * touches member data goes through one of these — never trust the proxy alone.
 */
import "server-only";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { db, schema } from "@/server/db";
import { auth } from "./auth";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  role: "member" | "admin";
  status: "active" | "suspended";
  username?: string | null;
  batch?: string | null;
  onboardedAt?: Date | null;
};

export class AuthError extends Error {
  constructor(public code: "UNAUTHENTICATED" | "FORBIDDEN") {
    super(code);
  }
}

/** Cached per request. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) return null;
  return s.user as unknown as SessionUser;
});

// Throttle "last seen" writes: at most once per hour per user per instance.
const lastTouch = new Map<string, number>();
function touchLastSeen(userId: string) {
  const now = Date.now();
  if ((lastTouch.get(userId) ?? 0) > now - 60 * 60 * 1000) return;
  lastTouch.set(userId, now);
  if (lastTouch.size > 20_000) lastTouch.clear();
  void db
    .update(schema.user)
    .set({ lastSeenAt: new Date() })
    .where(eq(schema.user.id, userId))
    .catch(() => {});
}

/** For pages: redirects to /login (or /onboarding) when needed. */
export async function requireUser(opts: { onboarded?: boolean } = { onboarded: true }): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u) redirect("/login");
  if (u.status === "suspended") redirect("/suspended");
  if (opts.onboarded !== false) {
    // Session cookie cache can lag right after onboarding, so confirm from DB.
    if (!u.username) {
      const row = await db.query.user.findFirst({ where: eq(schema.user.id, u.id), columns: { username: true } });
      if (!row?.username) redirect("/onboarding");
      u.username = row.username;
    }
  }
  touchLastSeen(u.id);
  return u;
}

/**
 * For admin pages. Role is re-read from the DB (not the 5-minute cookie cache)
 * so a demotion takes effect immediately. Non-admins get a 404, not a hint.
 */
export async function requireAdmin(): Promise<SessionUser> {
  const u = await requireUser();
  const row = await db.query.user.findFirst({ where: eq(schema.user.id, u.id), columns: { role: true, status: true } });
  if (row?.role !== "admin" || row.status !== "active") notFound();
  return { ...u, role: "admin" };
}

/** For server actions / route handlers: throws instead of redirecting. */
export async function assertUser(): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u) throw new AuthError("UNAUTHENTICATED");
  if (u.status === "suspended") throw new AuthError("FORBIDDEN");
  return u;
}

export async function assertAdmin(): Promise<SessionUser> {
  const u = await assertUser();
  const row = await db.query.user.findFirst({ where: eq(schema.user.id, u.id), columns: { role: true, status: true } });
  if (row?.role !== "admin" || row.status !== "active") throw new AuthError("FORBIDDEN");
  return { ...u, role: "admin" };
}
