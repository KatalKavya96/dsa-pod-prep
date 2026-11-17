import { db, schema } from "@/server/db";

export async function audit(actorId: string | null, action: string, entity: string, entityId?: string, meta?: Record<string, unknown>) {
  await db.insert(schema.auditLog).values({ actorId, action, entity, entityId, meta });
}
