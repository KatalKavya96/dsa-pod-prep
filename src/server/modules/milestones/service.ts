/**
 * Milestones: 5 sequential levels, fully admin-configurable (criteria, title,
 * badge text, colour, animation). Evaluated by the worker after each sync and
 * on demand when a member opens the dashboard.
 */
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { evaluateMilestones, type MemberMetrics } from "@/lib/domain/milestones";
import { db, schema } from "@/server/db";
import { rowsOf } from "@/server/db/sql";
import type { MilestoneCriterion } from "@/server/db/schema/app";
import { getStreak } from "../activity/service";
import { getMemberAttendance } from "../assignments/service";
import { audit } from "../audit";
import { z } from "zod";

const { milestone, userMilestone } = schema;

export async function listMilestones() {
  return db.select().from(milestone).orderBy(asc(milestone.level));
}

export async function getMemberMetrics(u: { id: string; createdAt: Date }): Promise<MemberMetrics> {
  const [attendance, streak, counts] = await Promise.all([
    getMemberAttendance(u),
    getStreak(u.id),
    db.execute(sql`select
      coalesce((select sum(total_solved)::int from platform_stats where user_id = ${u.id}), 0) as solved,
      (select count(*)::int from contest_history where user_id = ${u.id}) as contests,
      (select count(*)::int from resource_progress where user_id = ${u.id}) as resources`),
  ]);
  const c = rowsOf<{ solved: number; contests: number; resources: number }>(counts)[0];
  return {
    solved: c.solved,
    contests: c.contests,
    resourcesDone: c.resources,
    streak: streak.current,
    attendancePct: attendance.pct,
    attendanceEligible: attendance.eligible,
  };
}

/** Award any newly-earned milestones. Returns ids newly awarded. */
export async function evaluateMember(u: { id: string; createdAt: Date }): Promise<string[]> {
  const [defs, earnedRows, metrics] = await Promise.all([
    listMilestones(),
    db.select({ id: userMilestone.milestoneId }).from(userMilestone).where(eq(userMilestone.userId, u.id)),
    getMemberMetrics(u),
  ]);
  const already = new Set(earnedRows.map((r) => r.id));
  const nowEarned = evaluateMilestones(defs, metrics, already).filter((id) => !already.has(id));
  if (nowEarned.length) {
    await db.insert(userMilestone).values(nowEarned.map((milestoneId) => ({ userId: u.id, milestoneId }))).onConflictDoNothing();
  }
  return nowEarned;
}

export async function getMemberMilestones(userId: string) {
  return db.select().from(userMilestone).where(eq(userMilestone.userId, userId));
}

/** The oldest earned-but-not-yet-celebrated milestone (drives the celebration animation). */
export async function getPendingCelebration(userId: string) {
  const rows = await db
    .select({ m: milestone, achievedAt: userMilestone.achievedAt })
    .from(userMilestone)
    .innerJoin(milestone, eq(milestone.id, userMilestone.milestoneId))
    .where(and(eq(userMilestone.userId, userId), isNull(userMilestone.celebratedAt)))
    .orderBy(asc(milestone.level))
    .limit(1);
  return rows[0] ?? null;
}

export async function markCelebrated(userId: string, milestoneId: string) {
  await db
    .update(userMilestone)
    .set({ celebratedAt: new Date() })
    .where(and(eq(userMilestone.userId, userId), eq(userMilestone.milestoneId, milestoneId)));
}

const criterion: z.ZodType<MilestoneCriterion> = z.discriminatedUnion("type", [
  z.object({ type: z.literal("solved"), min: z.number().int().min(0) }),
  z.object({ type: z.literal("contests"), min: z.number().int().min(0) }),
  z.object({ type: z.literal("streak"), min: z.number().int().min(0) }),
  z.object({ type: z.literal("resources_done"), min: z.number().int().min(0) }),
  z.object({ type: z.literal("attendance_pct"), min: z.number().min(0).max(100), minEligible: z.number().int().min(0) }),
]);

export const milestoneInput = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(2).max(80),
  badgeTitle: z.string().trim().min(2).max(80),
  tagline: z.string().max(160).optional(),
  description: z.string().max(4000).optional(),
  icon: z.string().min(1).max(8),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  animation: z.enum(["glow", "confetti", "rise", "flame", "crown"]),
  criteria: z.array(criterion).max(10),
});

export async function updateMilestone(actorId: string, input: z.infer<typeof milestoneInput>) {
  const { id, ...rest } = input;
  await db.update(milestone).set({ ...rest, updatedAt: new Date() }).where(eq(milestone.id, id));
  await audit(actorId, "update", "milestone", id, { title: rest.title });
}

/** Placeholder track; replace content from the requirement docs via /admin/milestones. */
export const DEFAULT_MILESTONES = [
  { level: 1, title: "Foundations", badgeTitle: "Initiate", icon: "🌱", color: "#22c55e", animation: "glow",
    criteria: [{ type: "solved", min: 50 }] },
  { level: 2, title: "Consistency", badgeTitle: "Grinder", icon: "🔥", color: "#f97316", animation: "flame",
    criteria: [{ type: "solved", min: 150 }, { type: "streak", min: 7 }] },
  { level: 3, title: "Contest Ready", badgeTitle: "Competitor", icon: "⚔️", color: "#3b82f6", animation: "rise",
    criteria: [{ type: "solved", min: 300 }, { type: "contests", min: 10 }] },
  { level: 4, title: "Discipline", badgeTitle: "Strategist", icon: "🧠", color: "#a855f7", animation: "confetti",
    criteria: [{ type: "solved", min: 500 }, { type: "attendance_pct", min: 75, minEligible: 10 }] },
  { level: 5, title: "Mastery", badgeTitle: "Grandmaster of the POD", icon: "👑", color: "#eab308", animation: "crown",
    criteria: [{ type: "solved", min: 800 }, { type: "contests", min: 40 }, { type: "attendance_pct", min: 85, minEligible: 30 }] },
] as const satisfies ReadonlyArray<{ level: number; title: string; badgeTitle: string; icon: string; color: string; animation: string; criteria: readonly MilestoneCriterion[] }>;

export async function ensureDefaultMilestones() {
  await db
    .insert(milestone)
    .values(DEFAULT_MILESTONES.map((m) => ({ ...m, criteria: [...m.criteria] as MilestoneCriterion[], tagline: "Placeholder — edit in Admin → Milestones" })))
    .onConflictDoNothing();
}

/** Worker: evaluate members with recent activity. */
export async function evaluateRecentlyActive(limit = 2000) {
  const users = await db
    .select({ id: schema.user.id, createdAt: schema.user.createdAt })
    .from(schema.user)
    .where(sql`${schema.user.onboardedAt} is not null and ${schema.user.status} = 'active'
      and (${schema.user.lastSolveAt} >= now() - interval '3 days' or ${schema.user.lastSeenAt} >= now() - interval '3 days')`)
    .limit(limit);
  let awarded = 0;
  for (const u of users) awarded += (await evaluateMember(u)).length;
  return { checked: users.length, awarded };
}

/**
 * Builds the milestone track for a member and awards anything newly earned
 * (metrics are already computed for display, so awarding here is free).
 */
export async function getMilestoneView(u: { id: string; createdAt: Date }, opts: { award?: boolean } = { award: true }) {
  const { criterionProgress, milestoneProgress } = await import("@/lib/domain/milestones");
  // Always the live rows (5 of them): cached copies could carry stale ids after a re-seed.
  const [defs, metrics, earnedRows] = await Promise.all([listMilestones(), getMemberMetrics(u), getMemberMilestones(u.id)]);
  const earned = new Map(earnedRows.map((r) => [r.milestoneId, r.achievedAt]));
  if (opts.award) {
    const fresh = evaluateMilestones(defs, metrics, new Set(earned.keys())).filter((id) => !earned.has(id));
    if (fresh.length) {
      await db.insert(userMilestone).values(fresh.map((milestoneId) => ({ userId: u.id, milestoneId }))).onConflictDoNothing();
      for (const id of fresh) earned.set(id, new Date());
    }
  }
  const track = defs.map((m) => ({
    id: m.id,
    level: m.level,
    title: m.title,
    badgeTitle: m.badgeTitle,
    tagline: m.tagline,
    description: m.description,
    icon: m.icon,
    color: m.color,
    earned: earned.has(m.id),
    achievedAt: earned.get(m.id)?.toISOString() ?? null,
    progress: earned.has(m.id) ? 1 : milestoneProgress(m.criteria, metrics),
    criteria: m.criteria.map((c) => criterionProgress(c, metrics)),
  }));
  return { metrics, track };
}
