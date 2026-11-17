import { and, asc, eq, gte, sql } from "drizzle-orm";
import { db, schema } from "@/server/db";
import type { UpcomingContest } from "@/server/platforms";
import { z } from "zod";
import { audit } from "../audit";

const { contest } = schema;

/** Upsert synced contests; never overwrites admin edits to `hidden`/`notes`. Returns rows touched. */
export async function upsertSyncedContests(list: UpcomingContest[]): Promise<number> {
  if (!list.length) return 0;
  const rows = list.map((c) => ({
    platform: c.platform,
    externalId: c.externalId,
    title: c.title,
    url: c.url,
    registrationUrl: c.registrationUrl ?? null,
    requiresRegistration: c.requiresRegistration,
    startsAt: c.startsAt,
    durationSeconds: c.durationSeconds,
    source: "sync" as const,
  }));
  await db
    .insert(contest)
    .values(rows)
    .onConflictDoUpdate({
      target: [contest.platform, contest.externalId],
      set: {
        title: sql`excluded.title`,
        url: sql`excluded.url`,
        startsAt: sql`excluded.starts_at`,
        durationSeconds: sql`excluded.duration_seconds`,
        registrationUrl: sql`excluded.registration_url`,
        updatedAt: sql`now()`,
      },
      where: sql`${contest.source} = 'sync'`,
    });
  return rows.length;
}

export type ContestDTO = {
  id: string;
  platform: string;
  title: string;
  url: string;
  registrationUrl: string | null;
  requiresRegistration: boolean;
  startsAt: string;
  durationSeconds: number;
  source: string;
  notes: string | null;
};

/** Upcoming + currently running contests, visible ones only. Plain JSON (cache-safe). */
export async function listUpcomingContests(limit = 100): Promise<ContestDTO[]> {
  const rows = await db
    .select()
    .from(contest)
    .where(and(eq(contest.hidden, false), gte(sql`${contest.startsAt} + make_interval(secs => ${contest.durationSeconds})`, sql`now()`)))
    .orderBy(asc(contest.startsAt))
    .limit(limit);
  return rows.map(toDTO);
}

export function toDTO(c: typeof contest.$inferSelect): ContestDTO {
  return {
    id: c.id,
    platform: c.platform,
    title: c.title,
    url: c.url,
    registrationUrl: c.registrationUrl,
    requiresRegistration: c.requiresRegistration,
    startsAt: c.startsAt.toISOString(),
    durationSeconds: c.durationSeconds,
    source: c.source,
    notes: c.notes,
  };
}

export const contestInput = z.object({
  platform: z.enum(["leetcode", "codeforces", "codechef", "atcoder", "newton", "internal", "other"]),
  title: z.string().trim().min(3).max(200),
  url: z.url().max(500),
  registrationUrl: z.url().max(500).optional().or(z.literal("").transform(() => undefined)),
  requiresRegistration: z.boolean().default(false),
  startsAt: z.coerce.date(),
  durationMinutes: z.coerce.number().int().min(5).max(60 * 24 * 14),
  notes: z.string().max(1000).optional(),
});

export async function createCustomContest(actorId: string, input: z.infer<typeof contestInput>) {
  const [row] = await db
    .insert(contest)
    .values({
      platform: input.platform,
      externalId: `custom-${crypto.randomUUID()}`,
      title: input.title,
      url: input.url,
      registrationUrl: input.registrationUrl ?? null,
      requiresRegistration: input.requiresRegistration,
      startsAt: input.startsAt,
      durationSeconds: input.durationMinutes * 60,
      notes: input.notes ?? null,
      source: "admin",
      createdBy: actorId,
    })
    .returning();
  await audit(actorId, "create", "contest", row.id, { title: row.title });
  return row;
}

export async function setContestHidden(actorId: string, id: string, hidden: boolean) {
  await db.update(contest).set({ hidden, updatedAt: new Date() }).where(eq(contest.id, id));
  await audit(actorId, hidden ? "hide" : "unhide", "contest", id);
}

export async function deleteCustomContest(actorId: string, id: string) {
  await db.delete(contest).where(and(eq(contest.id, id), eq(contest.source, "admin")));
  await audit(actorId, "delete", "contest", id);
}

export async function listContestsForAdmin() {
  return db
    .select()
    .from(contest)
    .where(gte(contest.startsAt, sql`now() - interval '14 days'`))
    .orderBy(asc(contest.startsAt))
    .limit(300);
}
