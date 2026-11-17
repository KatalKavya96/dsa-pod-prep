import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/server/db";

const { notification } = schema;

export async function listNotifications(userId: string, limit = 20) {
  return db.select().from(notification).where(eq(notification.userId, userId)).orderBy(desc(notification.createdAt)).limit(limit);
}

export async function unreadCount(userId: string) {
  return db.$count(notification, and(eq(notification.userId, userId), isNull(notification.readAt)));
}

export async function markAllRead(userId: string) {
  await db.update(notification).set({ readAt: sql`now()` }).where(and(eq(notification.userId, userId), isNull(notification.readAt)));
}
