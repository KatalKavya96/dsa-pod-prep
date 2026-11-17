import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/server/db";
import { rowsOf } from "@/server/db/sql";
import { audit } from "../audit";

const { user } = schema;

export const RESERVED_USERNAMES = new Set(["admin", "api", "login", "dashboard", "settings", "u", "me", "root", "support"]);

export const onboardingInput = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(24)
    .regex(/^[a-z0-9_]+$/, "Use lowercase letters, digits and _")
    .refine((u) => !RESERVED_USERNAMES.has(u), "This username is reserved"),
  name: z.string().trim().min(2).max(80),
  batch: z.string().trim().min(1).max(50),
});

export async function completeOnboarding(userId: string, input: z.infer<typeof onboardingInput>) {
  const clash = await db.query.user.findFirst({ where: and(eq(user.username, input.username), sql`${user.id} <> ${userId}`) });
  if (clash) throw new Error("Username is taken");
  await db
    .update(user)
    .set({ username: input.username, name: input.name, batch: input.batch, onboardedAt: sql`coalesce(${user.onboardedAt}, now())`, updatedAt: new Date() })
    .where(eq(user.id, userId));
}

export async function getUserById(id: string) {
  return db.query.user.findFirst({ where: eq(user.id, id) });
}

export async function getUserByUsername(username: string) {
  return db.query.user.findFirst({ where: eq(user.username, username.toLowerCase()) });
}

export async function listBatches(): Promise<string[]> {
  const rows = await db.selectDistinct({ b: user.batch }).from(user).where(sql`${user.batch} is not null`);
  return rows.map((r) => r.b!).sort();
}

export async function listMembers(opts: { q?: string; batch?: string; page?: number; pageSize?: number }) {
  const pageSize = Math.min(opts.pageSize ?? 50, 200);
  const page = Math.max(1, opts.page ?? 1);
  const where = and(
    opts.q ? or(ilike(user.name, `%${opts.q}%`), ilike(user.email, `%${opts.q}%`), ilike(user.username, `%${opts.q}%`)) : undefined,
    opts.batch ? eq(user.batch, opts.batch) : undefined,
  );
  const [rows, total] = await Promise.all([
    db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username,
        batch: user.batch,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
        lastSeenAt: user.lastSeenAt,
        lastSolveAt: user.lastSolveAt,
        solved: sql<number>`coalesce((select sum(total_solved)::int from platform_stats ps where ps.user_id = ${user.id}), 0)`,
      })
      .from(user)
      .where(where)
      .orderBy(desc(user.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.$count(user, where),
  ]);
  return { rows, total, page, pageSize };
}

export async function setRole(actorId: string, targetId: string, role: "admin" | "member") {
  if (actorId === targetId && role !== "admin") throw new Error("You can't remove your own admin role");
  if (role === "member") {
    const admins = await db.$count(user, and(eq(user.role, "admin"), eq(user.status, "active")));
    if (admins <= 1) throw new Error("At least one admin must remain");
  }
  await db.update(user).set({ role, updatedAt: new Date() }).where(eq(user.id, targetId));
  // Drop sessions so the new role is picked up immediately (cookie cache is short anyway).
  await db.delete(schema.session).where(eq(schema.session.userId, targetId));
  await audit(actorId, "set_role", "user", targetId, { role });
}

export async function setStatus(actorId: string, targetId: string, status: "active" | "suspended") {
  if (actorId === targetId) throw new Error("You can't suspend yourself");
  await db.update(user).set({ status, updatedAt: new Date() }).where(eq(user.id, targetId));
  if (status === "suspended") await db.delete(schema.session).where(eq(schema.session.userId, targetId));
  await audit(actorId, "set_status", "user", targetId, { status });
}

/** Leaderboard over the last N days by active days and submissions, plus total solved. */
export async function leaderboard(days = 7, limit = 100) {
  return rowsOf<{ username: string; name: string; image: string | null; batch: string | null; active_days: number; submissions: number; solved: number }>(
    await db.execute(sql`
      select u.username, u.name, u.image, u.batch,
        count(distinct da.day)::int as active_days,
        coalesce(sum(da.submissions), 0)::int as submissions,
        coalesce((select sum(total_solved)::int from platform_stats ps where ps.user_id = u.id), 0) as solved
      from "user" u
      join daily_activity da on da.user_id = u.id and da.day >= current_date - ${days}::int and da.submissions > 0
      where u.status = 'active' and u.username is not null
      group by u.id
      order by active_days desc, submissions desc
      limit ${limit}`),
  );
}

export async function adminOverview() {
  const [r] = rowsOf<{
    members: number;
    onboarded: number;
    active7: number;
    verified_handles: number;
    open_tasks: number;
    seen7: number;
  }>(
    await db.execute(sql`select
      (select count(*)::int from "user") as members,
      (select count(*)::int from "user" where onboarded_at is not null) as onboarded,
      (select count(*)::int from "user" where last_solve_at >= now() - interval '7 days') as active7,
      (select count(*)::int from "user" where last_seen_at >= now() - interval '7 days') as seen7,
      (select count(*)::int from platform_handle where verified_at is not null) as verified_handles,
      (select count(*)::int from assignment where archived = false and due_at >= now()) as open_tasks`),
  );
  return r;
}
