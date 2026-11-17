/**
 * Pulls member data from platforms into our DB. Runs only in the worker,
 * never during a page request.
 *
 * Scheduling: "stalest first" — each run takes the N handles synced longest
 * ago, so with 5,000 members every handle is refreshed in rotation without
 * a burst of thousands of requests. Members with open tasks get priority.
 */
import { and, asc, eq, isNotNull, lt, or, sql, isNull } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { rowsOf } from "@/server/db/sql";
import { adapters, PlatformError, type JudgePlatform, type UserSnapshot } from "@/server/platforms";
import { fetchCfRatings } from "@/server/platforms/codeforces";

const { platformHandle } = schema;

export async function applySnapshot(userId: string, platform: JudgePlatform, s: UserSnapshot) {
  await db.transaction(async (tx) => {
    await tx
      .insert(schema.platformStats)
      .values({
        userId,
        platform,
        totalSolved: s.totalSolved,
        easySolved: s.easySolved,
        mediumSolved: s.mediumSolved,
        hardSolved: s.hardSolved,
        rating: s.rating ?? null,
        maxRating: s.maxRating ?? null,
        contestsAttended: s.contests.length,
      })
      .onConflictDoUpdate({
        target: [schema.platformStats.userId, schema.platformStats.platform],
        set: s.partial
          ? { updatedAt: new Date() }
          : {
              totalSolved: s.totalSolved,
              easySolved: s.easySolved,
              mediumSolved: s.mediumSolved,
              hardSolved: s.hardSolved,
              rating: s.rating ?? null,
              maxRating: s.maxRating ?? null,
              updatedAt: new Date(),
            },
      });

    const days = Object.entries(s.dailySubmissions);
    for (let i = 0; i < days.length; i += 500) {
      await tx
        .insert(schema.dailyActivity)
        .values(days.slice(i, i + 500).map(([day, n]) => ({ userId, platform, day, submissions: n })))
        .onConflictDoUpdate({
          target: [schema.dailyActivity.userId, schema.dailyActivity.day, schema.dailyActivity.platform],
          set: { submissions: sql`greatest(${schema.dailyActivity.submissions}, excluded.submissions)` },
        });
    }

    for (let i = 0; i < s.solves.length; i += 500) {
      await tx
        .insert(schema.solvedProblem)
        .values(s.solves.slice(i, i + 500).map((x) => ({ userId, platform, problemKey: x.problemKey, firstSolvedAt: x.solvedAt })))
        .onConflictDoNothing();
    }

    if (s.contests.length) {
      await tx
        .insert(schema.contestHistory)
        .values(
          s.contests.map((c) => ({
            userId,
            platform,
            contestExternalId: c.externalId,
            contestTitle: c.title,
            rated: c.rated,
            rank: c.rank ?? null,
            newRating: c.newRating ?? null,
            participatedAt: c.at,
          })),
        )
        .onConflictDoNothing();
    }

    // Totals from accumulated history (correct even when this fetch was partial).
    const [{ solved, contests }] = rowsOf<{ solved: number; contests: number }>(
      await tx.execute(sql`select
        (select count(*)::int from solved_problem where user_id = ${userId} and platform = ${platform}) as solved,
        (select count(*)::int from contest_history where user_id = ${userId} and platform = ${platform}) as contests`),
    );
    await tx
      .update(schema.platformStats)
      .set({
        contestsAttended: contests,
        ...(s.partial ? { totalSolved: sql`greatest(${schema.platformStats.totalSolved}, ${solved})` } : {}),
      })
      .where(and(eq(schema.platformStats.userId, userId), eq(schema.platformStats.platform, platform)));

    const lastActive = days.filter(([, n]) => n > 0).map(([d]) => d).sort().at(-1);
    if (lastActive) {
      await tx
        .update(schema.user)
        .set({ lastSolveAt: sql`greatest(coalesce(${schema.user.lastSolveAt}, 'epoch'), ${lastActive + "T12:00:00Z"}::timestamptz)` })
        .where(eq(schema.user.id, userId));
    }
  });
}

export async function syncHandle(h: typeof platformHandle.$inferSelect): Promise<"ok" | "failed"> {
  try {
    const snap = await adapters[h.platform].fetchUserSnapshot(h.handle, { full: !h.lastSyncedAt });
    await applySnapshot(h.userId, h.platform, snap);
    await db
      .update(platformHandle)
      .set({ lastSyncedAt: new Date(), syncError: null, consecutiveFailures: 0 })
      .where(eq(platformHandle.id, h.id));
    return "ok";
  } catch (e) {
    const msg = e instanceof PlatformError ? `${e.kind}: ${e.message}` : String(e);
    // Still bump lastSyncedAt so a broken handle doesn't block the queue.
    await db
      .update(platformHandle)
      .set({ lastSyncedAt: new Date(), syncError: msg.slice(0, 500), consecutiveFailures: sql`${platformHandle.consecutiveFailures} + 1` })
      .where(eq(platformHandle.id, h.id));
    return "failed";
  }
}

/** Pick the stalest verified handles for a platform. */
export async function pickHandlesToSync(platform: JudgePlatform, limit: number, minAgeMinutes = 60) {
  return db
    .select()
    .from(platformHandle)
    .where(
      and(
        eq(platformHandle.platform, platform),
        isNotNull(platformHandle.verifiedAt),
        lt(platformHandle.consecutiveFailures, 20),
        or(isNull(platformHandle.lastSyncedAt), lt(platformHandle.lastSyncedAt, sql`now() - make_interval(mins => ${minAgeMinutes})`)),
      ),
    )
    // Members who have an open practice task first, then stalest.
    .orderBy(
      sql`case when exists (
        select 1 from assignment a where a.archived = false and a.kind = 'practice'
          and a.starts_at <= now() and a.due_at >= now() - interval '1 day') then 0 else 1 end`,
      sql`${platformHandle.lastSyncedAt} asc nulls first`,
      asc(platformHandle.createdAt),
    )
    .limit(limit);
}

/** Run a bounded sync pass with small concurrency per platform. */
export async function runSyncPass(opts: { perPlatform: number; concurrency?: number; deadlineMs?: number }) {
  const deadline = Date.now() + (opts.deadlineMs ?? 50 * 60 * 1000);
  const result: Record<string, { ok: number; failed: number }> = {};
  await Promise.all(
    (["leetcode", "codeforces", "codechef"] as const).map(async (p) => {
      const batch = await pickHandlesToSync(p, opts.perPlatform);
      const stats = { ok: 0, failed: 0 };
      result[p] = stats;
      if (p === "codeforces" && batch.length) await refreshCfRatings(batch.map((h) => ({ userId: h.userId, handle: h.handle })));
      // Codeforces must stay sequential (2s/request limit); others get light parallelism.
      const conc = p === "codeforces" ? 1 : (opts.concurrency ?? 3);
      let i = 0;
      await Promise.all(
        Array.from({ length: conc }, async () => {
          while (i < batch.length && Date.now() < deadline) {
            const h = batch[i++];
            stats[(await syncHandle(h)) === "ok" ? "ok" : "failed"]++;
          }
        }),
      );
    }),
  );
  return result;
}

async function refreshCfRatings(items: { userId: string; handle: string }[]) {
  const ratings = await fetchCfRatings(items.map((i) => i.handle));
  for (const it of items) {
    const r = ratings.get(it.handle.toLowerCase());
    if (!r) continue;
    await db
      .insert(schema.platformStats)
      .values({ userId: it.userId, platform: "codeforces", rating: r.rating ?? null, maxRating: r.maxRating ?? null })
      .onConflictDoUpdate({
        target: [schema.platformStats.userId, schema.platformStats.platform],
        set: { rating: r.rating ?? null, maxRating: r.maxRating ?? null },
      });
  }
}
