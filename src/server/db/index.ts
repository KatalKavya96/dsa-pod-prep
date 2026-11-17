/**
 * Single database entry point.
 *
 * - Production: Neon *pooled* connection string through postgres.js.
 *   `prepare: false` because PgBouncer transaction pooling can't keep prepared
 *   statements. A small pool per serverless instance keeps total connections
 *   bounded even at thousands of concurrent users.
 * - Local dev: real Postgres (`docker compose up -d`, or a free Neon dev branch).
 * - Tests: `pglite:memory` runs a throwaway Postgres in-process (no setup).
 *   PGlite is NOT used for `next dev`: Next spawns several processes and a
 *   PGlite folder must only ever be opened by one.
 */
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePg, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/server/env";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;

export function createDb(url: string): Db {
  if (url.startsWith("pglite:")) {
    const dir = url.slice("pglite:".length);
    const client = new PGlite(dir === "memory" ? undefined : dir);
    // Same query-builder API as postgres-js; the cast keeps one Db type app-wide.
    return drizzlePglite(client, { schema }) as unknown as Db;
  }
  const client = postgres(url, {
    max: Number(process.env.DB_POOL_MAX ?? 5),
    prepare: false,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  return drizzlePg(client, { schema });
}

// Keyed on `process` (not globalThis): Next dev can evaluate this module in more
// than one module context per process, and a second PGlite on the same folder aborts.
const g = process as unknown as { __dsaPodDb?: Db };

/** Shared instance, reused across dev hot reloads and module contexts. */
export const db: Db = g.__dsaPodDb ?? (g.__dsaPodDb = createDb(env.DATABASE_URL));

export { schema };
