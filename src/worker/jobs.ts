/**
 * Background jobs. Each job is idempotent and bounded in time, so it is safe
 * to run from GitHub Actions cron, a free VM's crontab, or /api/cron/<job>.
 */
import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { env } from "@/server/env";
import { evaluateActiveAssignments } from "@/server/modules/assignments/service";
import { upsertSyncedContests } from "@/server/modules/contests/service";
import { listInactiveMembers } from "@/server/modules/alerts/service";
import { evaluateRecentlyActive, ensureDefaultMilestones } from "@/server/modules/milestones/service";
import { sendTelegram } from "@/server/modules/notifications/channels";
import { sendDueReminders } from "@/server/modules/notifications/reminders";
import { runSyncPass } from "@/server/modules/sync/service";
import { adapters, JUDGE_PLATFORMS } from "@/server/platforms";

export const jobs = {
  /** Pull upcoming contests from all platforms (each platform fails independently). */
  async "sync-contests"() {
    const out: Record<string, number | string> = {};
    for (const p of JUDGE_PLATFORMS) {
      try {
        out[p] = await upsertSyncedContests(await adapters[p].fetchUpcomingContests());
      } catch (e) {
        out[p] = `error: ${String(e).slice(0, 200)}`;
      }
    }
    return out;
  },

  /** Refresh member stats (stalest first), then re-evaluate tasks and milestones. */
  async "sync-members"() {
    const perPlatform = Number(process.env.SYNC_PER_PLATFORM ?? 600);
    const synced = await runSyncPass({ perPlatform, deadlineMs: Number(process.env.SYNC_DEADLINE_MS ?? 40 * 60_000) });
    const evaluated = await evaluateActiveAssignments();
    const milestones = await evaluateRecentlyActive();
    return { synced, evaluated, milestones };
  },

  async "evaluate"() {
    return { assignments: await evaluateActiveAssignments(), milestones: await evaluateRecentlyActive() };
  },

  async reminders() {
    return sendDueReminders(env.BETTER_AUTH_URL);
  },

  /** Daily digest for admins (Telegram), the full list lives in /admin/alerts. */
  async "inactive-digest"() {
    const list = await listInactiveMembers({ days: 7, limit: 5000 });
    const by = (r: string) => list.filter((m) => m.reason === r).length;
    const text = `📉 Daily POD health\nInactive 7d+: ${by("inactive")}\nSkipping tasks: ${by("skipping_tasks")}\nNever active: ${by("never_active")}\nNo verified handle: ${by("no_handles")}\n${env.BETTER_AUTH_URL}/admin/alerts`;
    if (env.TELEGRAM_ADMIN_CHAT_ID) await sendTelegram(text, env.TELEGRAM_ADMIN_CHAT_ID);
    return { flagged: list.length };
  },

  async "seed-milestones"() {
    await ensureDefaultMilestones();
    return { ok: true };
  },
} satisfies Record<string, () => Promise<unknown>>;

export type JobName = keyof typeof jobs;

/** Runs a job and records its outcome in job_state (shown on /admin/health). */
export async function runJob(name: JobName) {
  const started = new Date();
  await db
    .insert(schema.jobState)
    .values({ name, lastRunAt: started })
    .onConflictDoUpdate({ target: schema.jobState.name, set: { lastRunAt: started } });
  try {
    const data = (await jobs[name]()) as Record<string, unknown>;
    await db.update(schema.jobState).set({ lastOkAt: new Date(), lastError: null, data }).where(eq(schema.jobState.name, name));
    return data;
  } catch (e) {
    await db
      .update(schema.jobState)
      .set({ lastError: String(e).slice(0, 1000) })
      .where(eq(schema.jobState.name, name));
    throw e;
  }
}

export const isJobName = (n: string): n is JobName => Object.prototype.hasOwnProperty.call(jobs, n);
