/**
 * Repairs stages that claim an outcome before their day has come: a stage marked done or failed
 * while its scheduled date is in the future is really a plan, so it becomes "planned". The date is
 * kept — only the claim about the result is dropped.
 *
 * Dry run by default; pass `--apply` to write:
 *
 *   bun run fix:stage-states
 *   bun run fix:stage-states --apply
 */
import postgres from "postgres";
import { repairedStageState } from "../src/lib/stage-rules";

const apply = process.argv.includes("--apply");
const url =
  process.env.DATABASE_URL ??
  `postgres://${process.env.POSTGRES_USER ?? "offerhive"}:${encodeURIComponent(process.env.POSTGRES_PASSWORD ?? "")}` +
    `@${process.env.POSTGRES_HOST ?? "localhost"}:${process.env.DB_PORT ?? "5432"}/${process.env.POSTGRES_DB ?? "offerhive"}`;

const sql = postgres(url, { onnotice: () => {} });

const rows = await sql<
  { id: string; user_id: string; state: string; scheduled_at: Date | null; application_id: string }[]
>`
  select id, user_id, state, scheduled_at, application_id
  from application_stages
  where state in ('done', 'failed') and scheduled_at is not null and scheduled_at > now()`;

type Fix = { id: string; userId: string; state: string; scheduledAt: string };

const fixes: Fix[] = [];
for (const row of rows) {
  const scheduledAt = row.scheduled_at!.toISOString();
  const next = repairedStageState({ state: row.state as never, scheduledAt });
  if (next) fixes.push({ id: row.id, userId: row.user_id, state: row.state, scheduledAt });
}

if (fixes.length === 0) {
  console.log("Nothing to repair: no finished stage is dated in the future.");
} else {
  console.log(
    `${apply ? "Repairing" : "Would repair"} ${fixes.length} stage${fixes.length === 1 ? "" : "s"}:`,
  );
  for (const fix of fixes) {
    console.log(`  ${fix.id.slice(0, 8)}  ${fix.state} (${fix.scheduledAt.slice(0, 10)}) → planned`);
  }
}

if (fixes.length > 0 && apply) {
  for (const fix of fixes) {
    await sql`update application_stages set state = 'planned', updated_at = now() where id = ${fix.id}::uuid`;
  }
  // The per-user board cache is invalidated on the next read; nothing else to sync here.
  console.log(`Done: ${fixes.length} stage${fixes.length === 1 ? "" : "s"} set to planned.`);
} else if (fixes.length > 0) {
  console.log("Dry run: nothing written. Re-run with --apply to change these rows.");
}

await sql.end();
