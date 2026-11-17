/** Applies SQL migrations in ./drizzle to DATABASE_URL (Postgres or PGlite). */
import "./load-env";
import { mkdirSync } from "node:fs";

async function main() {
  const url = process.env.DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:5433/dsapod";
  if (url.startsWith("pglite:")) {
    const dir = url.slice("pglite:".length);
    if (dir !== "memory") mkdirSync(dir, { recursive: true });
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    const client = new PGlite(dir);
    await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
    await client.close();
  } else {
    const postgres = (await import("postgres")).default;
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    // Use the DIRECT (non-pooled) URL for migrations if provided.
    const client = postgres(process.env.DATABASE_URL_DIRECT ?? url, { max: 1 });
    await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
    await client.end();
  }
  console.log("migrations applied");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
