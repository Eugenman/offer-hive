/**
 * Where the database is. Production (Vercel, Neon) sets DATABASE_URL. Locally the URL is built from
 * the docker-compose settings in .env, so the password is written once and no tool has to expand
 * `${...}` inside .env (drizzle-kit doesn't).
 *
 * No `server-only` here: drizzle.config.ts imports this file too.
 */
export function databaseUrl(env: Record<string, string | undefined> = process.env): string | null {
  if (env.DATABASE_URL) return env.DATABASE_URL;
  if (!env.POSTGRES_PASSWORD) return null;
  const password = encodeURIComponent(env.POSTGRES_PASSWORD);
  return `postgres://offerhive:${password}@localhost:${env.DB_PORT ?? "5432"}/offerhive`;
}
