import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/server/db";
import { audit } from "../audit";

const { topic, resource, resourceProgress } = schema;

export type TopicWithResources = Awaited<ReturnType<typeof listTopicsWithResources>>[number];

/** Shared across all members → cached by the caller. */
export async function listTopicsWithResources() {
  const [topics, resources] = await Promise.all([
    db.select().from(topic).orderBy(asc(topic.position), asc(topic.name)),
    db.select().from(resource).orderBy(asc(resource.position), asc(resource.createdAt)),
  ]);
  return topics.map((t) => ({
    ...t,
    resources: resources
      .filter((r) => r.topicId === t.id)
      .map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
  }));
}

export async function getDoneResourceIds(userId: string): Promise<string[]> {
  const rows = await db.select({ id: resourceProgress.resourceId }).from(resourceProgress).where(eq(resourceProgress.userId, userId));
  return rows.map((r) => r.id);
}

export async function toggleResourceDone(userId: string, resourceId: string, done: boolean) {
  if (done) await db.insert(resourceProgress).values({ userId, resourceId }).onConflictDoNothing();
  else await db.delete(resourceProgress).where(and(eq(resourceProgress.userId, userId), eq(resourceProgress.resourceId, resourceId)));
}

export const topicInput = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().max(1000).optional(),
  position: z.coerce.number().int().min(0).max(1000).default(0),
});

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60);

export async function createTopic(actorId: string, input: z.infer<typeof topicInput>) {
  const [t] = await db
    .insert(topic)
    .values({ ...input, slug: `${slugify(input.name)}-${crypto.randomUUID().slice(0, 4)}` })
    .returning();
  await audit(actorId, "create", "topic", t.id, { name: t.name });
  return t;
}

export async function deleteTopic(actorId: string, id: string) {
  await db.delete(topic).where(eq(topic.id, id));
  await audit(actorId, "delete", "topic", id);
}

export const resourceInput = z.object({
  topicId: z.string().min(1),
  kind: z.enum(["problem", "article", "video", "sheet"]),
  title: z.string().trim().min(2).max(200),
  url: z.url().max(500),
  platform: z.enum(["leetcode", "codeforces", "codechef", "atcoder", "newton", "internal", "other"]).optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  note: z.string().max(1000).optional(),
});

export async function createResource(actorId: string, input: z.infer<typeof resourceInput>) {
  const [{ next }] = (await db
    .select({ next: sql<number>`coalesce(max(${resource.position}), -1)::int + 1` })
    .from(resource)
    .where(eq(resource.topicId, input.topicId))) as { next: number }[];
  const [r] = await db.insert(resource).values({ ...input, position: next }).returning();
  await audit(actorId, "create", "resource", r.id, { title: r.title });
  return r;
}

export async function deleteResource(actorId: string, id: string) {
  await db.delete(resource).where(eq(resource.id, id));
  await audit(actorId, "delete", "resource", id);
}
