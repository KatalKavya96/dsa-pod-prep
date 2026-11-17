/**
 * Seeds milestones (placeholders) and a starter set of topics/resources.
 * Safe to re-run. `pnpm db:seed -- --demo` also adds demo members/tasks for local testing.
 */
import "./load-env";
import { sql } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { ensureDefaultMilestones } from "@/server/modules/milestones/service";

const TOPICS: { name: string; description: string; items: { title: string; url: string; difficulty: "easy" | "medium" | "hard"; note: string }[] }[] = [
  {
    name: "Arrays & Hashing",
    description: "Frequency maps, prefix sums, two-pass tricks.",
    items: [
      { title: "Two Sum", url: "https://leetcode.com/problems/two-sum/", difficulty: "easy", note: "The canonical hash-map lookup pattern." },
      { title: "Subarray Sum Equals K", url: "https://leetcode.com/problems/subarray-sum-equals-k/", difficulty: "medium", note: "Prefix sums + hashmap: shows up everywhere." },
      { title: "Longest Consecutive Sequence", url: "https://leetcode.com/problems/longest-consecutive-sequence/", difficulty: "medium", note: "O(n) with a set: think about where a run starts." },
    ],
  },
  {
    name: "Binary Search",
    description: "Search on index and on answer.",
    items: [
      { title: "Binary Search", url: "https://leetcode.com/problems/binary-search/", difficulty: "easy", note: "Get the loop invariant right once, reuse forever." },
      { title: "Koko Eating Bananas", url: "https://leetcode.com/problems/koko-eating-bananas/", difficulty: "medium", note: "Binary search on the answer." },
      { title: "Median of Two Sorted Arrays", url: "https://leetcode.com/problems/median-of-two-sorted-arrays/", difficulty: "hard", note: "Partition thinking." },
    ],
  },
];

async function main() {
  await ensureDefaultMilestones();
  for (const [i, t] of TOPICS.entries()) {
    const slug = t.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const [topic] = await db
      .insert(schema.topic)
      .values({ slug, name: t.name, description: t.description, position: i })
      .onConflictDoUpdate({ target: schema.topic.slug, set: { name: t.name } })
      .returning();
    const existing = await db.$count(schema.resource, sql`${schema.resource.topicId} = ${topic.id}`);
    if (!existing) {
      await db.insert(schema.resource).values(
        t.items.map((it, j) => ({ topicId: topic.id, kind: "problem" as const, platform: "leetcode" as const, position: j, ...it })),
      );
    }
  }

  if (process.argv.includes("--demo")) {
    const now = Date.now();
    const members = Array.from({ length: 12 }, (_, i) => ({
      id: `demo-${i}`,
      name: `Demo Member ${i + 1}`,
      email: `demo${i + 1}@example.com`,
      username: `demo${i + 1}`,
      batch: i % 2 ? "2027" : "2026",
      onboardedAt: new Date(),
      createdAt: new Date(now - 40 * 86400_000),
      lastSolveAt: i < 8 ? new Date(now - (i % 4) * 86400_000) : new Date(now - 15 * 86400_000),
    }));
    await db.insert(schema.user).values(members).onConflictDoNothing();
    // Synthetic activity so heatmaps/leaderboard have something to show.
    const rows = members.flatMap((m, i) =>
      Array.from({ length: 120 }, (_, d) => ({
        userId: m.id,
        day: new Date(now - d * 86400_000).toISOString().slice(0, 10),
        platform: "leetcode" as const,
        submissions: (d * 7 + i * 3) % 5 === 0 ? 0 : ((d + i) % 6) + (i < 8 ? 1 : 0),
      })).filter((r) => r.submissions > 0 && (i < 8 || r.day < new Date(now - 15 * 86400_000).toISOString().slice(0, 10))),
    );
    for (let k = 0; k < rows.length; k += 500) await db.insert(schema.dailyActivity).values(rows.slice(k, k + 500)).onConflictDoNothing();
    await db
      .insert(schema.platformStats)
      .values(members.map((m, i) => ({ userId: m.id, platform: "leetcode" as const, totalSolved: 30 + i * 25, easySolved: 20 + i * 10, mediumSolved: 10 + i * 12, hardSolved: i * 3, rating: 1400 + i * 30 })))
      .onConflictDoNothing();
    await db
      .insert(schema.contest)
      .values([
        { platform: "newton", externalId: "demo-newton-1", title: "Newton School Coding Contest (demo)", url: "https://my.newtonschool.co/", startsAt: new Date(now + 3 * 3600_000), durationSeconds: 7200, source: "admin", requiresRegistration: true, registrationUrl: "https://my.newtonschool.co/" },
        { platform: "internal", externalId: "demo-pod-1", title: "POD Weekly Mock (demo)", url: "https://example.com/mock", startsAt: new Date(now + 2 * 86400_000 + 5 * 3600_000), durationSeconds: 5400, source: "admin" },
      ])
      .onConflictDoNothing();
    console.log("demo data added");
  }
  console.log("seed complete");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
