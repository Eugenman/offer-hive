import { defineConfig } from "drizzle-kit";
import { databaseUrl } from "./src/lib/db/url";

// Migrations are SQL files in drizzle/, generated from src/lib/db/schema.ts and committed.
//   bun run db:generate   new migration after a schema change
//   bun run db:migrate    apply pending migrations (DATABASE_URL, or the local docker-compose database)
const url = databaseUrl();

// Say where the migrations go. Without DATABASE_URL the URL silently falls back to the local
// docker-compose database, and a migration applied to the wrong place still reports success.
if (url) {
  let target = "DATABASE_URL is not a URL";
  try {
    target = new URL(url).host;
  } catch {
    // Keep the message above: printing the raw value would print the password.
  }
  console.log(`Migrations target: ${target}`);
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: url ?? "" },
  strict: true,
});
