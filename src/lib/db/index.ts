import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { databaseUrl } from "./url";

function createDb() {
  const url = databaseUrl();
  if (!url)
    throw new Error(
      "No database: set DATABASE_URL, or POSTGRES_PASSWORD for the local one (see .env.example).",
    );
  // Serverless platforms run many small instances, and hosted Postgres (Neon) limits the number of
  // connections, so the pool stays small: every request here is short. DATABASE_POOL_MAX overrides it.
  const poolMax = Number.parseInt(process.env.DATABASE_POOL_MAX ?? "", 10);
  // prepare: false — Neon's pooled connections (PgBouncer) don't support prepared statements.
  const client = postgres(url, {
    max: Number.isInteger(poolMax) && poolMax > 0 ? poolMax : 2,
    prepare: false,
  });
  return drizzle(client, { schema });
}

export type Database = ReturnType<typeof createDb>;

// One connection pool per server process. In development hot reloads re-run this module,
// so the pool is kept on globalThis instead of opening a new one on every change.
const globalForDb = globalThis as unknown as { offerhiveDb?: Database };

/** The database, connected on first use (so `next build` never needs DATABASE_URL). */
export function getDb(): Database {
  globalForDb.offerhiveDb ??= createDb();
  return globalForDb.offerhiveDb;
}
