import { defineConfig } from "drizzle-kit";
import { databaseUrl } from "./src/lib/db/url";

// Migrations are SQL files in drizzle/, generated from src/lib/db/schema.ts and committed.
//   bun run db:generate   new migration after a schema change
//   bun run db:migrate    apply pending migrations (DATABASE_URL, or the local docker-compose database)
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: databaseUrl() ?? "" },
  strict: true,
});
