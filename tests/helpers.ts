import { migrate } from "drizzle-orm/pglite/migrator";
import { db, schema } from "@/server/db";

let migrated = false;
export async function setupDb() {
  if (!migrated) {
    await migrate(db as never, { migrationsFolder: "./drizzle" });
    migrated = true;
  }
  return db;
}

let n = 0;
export async function makeUser(over: Partial<typeof schema.user.$inferInsert> = {}) {
  n++;
  const [u] = await db
    .insert(schema.user)
    .values({
      id: `u${n}-${crypto.randomUUID().slice(0, 6)}`,
      name: `User ${n}`,
      email: `user${n}-${crypto.randomUUID().slice(0, 6)}@example.com`,
      username: `user${n}_${crypto.randomUUID().slice(0, 6).replace(/-/g, "")}`,
      batch: "2026",
      onboardedAt: new Date(),
      createdAt: new Date(Date.now() - 30 * 86400_000),
      ...over,
    })
    .returning();
  return u;
}

export const hoursFromNow = (h: number) => new Date(Date.now() + h * 3600_000);
