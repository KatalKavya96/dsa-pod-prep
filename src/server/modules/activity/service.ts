import { sql } from "drizzle-orm";
import { computeStreaks } from "@/lib/domain/streak";
import { db } from "@/server/db";
import { rowsOf } from "@/server/db/sql";

/** Last 365 days of submissions summed across platforms: { "YYYY-MM-DD": count }. */
export async function getHeatmap(userId: string): Promise<Record<string, number>> {
  const rows = rowsOf<{ day: string; n: number }>(
    await db.execute(sql`select day::text as day, sum(submissions)::int as n from daily_activity
      where user_id = ${userId} and day >= (current_date - 371) group by day`),
  );
  return Object.fromEntries(rows.map((r) => [r.day, r.n]));
}

export async function getStreak(userId: string) {
  const heat = await getHeatmap(userId);
  return computeStreaks(Object.entries(heat).filter(([, n]) => n > 0).map(([d]) => d));
}

export async function getPlatformStats(userId: string) {
  return rowsOf<{
    platform: string;
    total_solved: number;
    easy_solved: number;
    medium_solved: number;
    hard_solved: number;
    rating: number | null;
    max_rating: number | null;
    contests_attended: number;
    updated_at: string;
  }>(await db.execute(sql`select platform::text, total_solved, easy_solved, medium_solved, hard_solved, rating, max_rating,
      contests_attended, updated_at from platform_stats where user_id = ${userId} order by platform`));
}
