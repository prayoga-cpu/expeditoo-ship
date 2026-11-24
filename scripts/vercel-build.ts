/**
 * The Vercel build command (`vercel.json` → `pnpm build:vercel`).
 *
 *   production (main)  gate → destructive check → migrate PRODUCTION → build
 *   dev branch         gate → destructive check → migrate the dev DB → build
 *   any other preview  build only
 *
 * Why, and why in this order: `src/lib/build-migrate.ts`, AGENTS.md §4a.
 *
 * Every step can stop the build. A stopped build is never promoted, so the
 * previous deployment keeps serving — and because the gate runs first, a
 * schema is only ever migrated by a commit that passed it. Migrations are
 * additive, so the deployment still serving tolerates a schema migrated ahead
 * of it when a later step fails.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

import {
  buildPlan,
  destructiveChanges,
  gateEnv,
  GATE_SCRIPTS,
  isConnectionFailure,
  pendingMigrations,
  type JournalEntry,
  type MigrationTarget,
} from "../src/lib/build-migrate";
import { describeDatabase, normaliseConnectionString } from "../src/lib/db-target";

const ATTEMPTS = 4;
const MIGRATIONS = join(process.cwd(), "src", "db", "migrations");

function sleep(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function stop(message: string): never {
  console.error(`❌ ${message}`);
  process.exit(1);
}

function runGate(): void {
  for (const script of GATE_SCRIPTS) {
    console.log(`▶ gate: pnpm ${script}`);
    const env = gateEnv(process.env) as NodeJS.ProcessEnv; // deliberately without NODE_ENV
    const run = spawnSync("pnpm", [script], { stdio: "inherit", env });
    if (run.status !== 0) stop(`Gate failed at \`pnpm ${script}\` — nothing was migrated or built.`);
  }
}

/** DDL wants the direct endpoint: Neon's pooler is PgBouncer in transaction mode. */
function migrationUrl(): string {
  const raw = process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL;
  if (!raw) stop("No POSTGRES_URL_NON_POOLING or POSTGRES_URL in this build.");
  return normaliseConnectionString(raw);
}

function checkTarget(url: string, target: MigrationTarget): void {
  const db = describeDatabase(url);
  if (target === "production" && !db.isProduction) {
    stop(`A production build was about to migrate "${db.label}", which is not production.`);
  }
  if (target === "dev" && db.isProduction) {
    stop(`The dev build was handed PRODUCTION (${db.label}). Fix the Preview (dev) POSTGRES_URL_NON_POOLING.`);
  }
  console.log(`▶ migration target (${target}): ${db.label}`);
}

async function lastAppliedWhen(url: string): Promise<number | null> {
  for (let attempt = 1; ; attempt++) {
    const sql = postgres(url, { max: 1, onnotice: () => {} });
    try {
      const rows = await sql`select max(created_at)::text as last from drizzle.__drizzle_migrations`;
      return rows[0]?.last ? Number(rows[0].last) : null;
    } catch (error) {
      const text = String((error as { code?: string; message?: string })?.code ?? "") + String(error);
      if (/42P01|3F000/.test(text)) return null; // no journal yet: everything is pending
      if (attempt >= ATTEMPTS || !isConnectionFailure(text)) throw error;
      console.log(`Database not reachable yet (attempt ${attempt}/${ATTEMPTS}), retrying in ${attempt * 5}s…`);
      sleep(attempt * 5000);
    } finally {
      await sql.end({ timeout: 5 });
    }
  }
}

async function checkPending(url: string): Promise<void> {
  const journal = JSON.parse(readFileSync(join(MIGRATIONS, "meta", "_journal.json"), "utf8")) as {
    entries: JournalEntry[];
  };
  const pending = pendingMigrations(journal.entries, await lastAppliedWhen(url));
  if (pending.length === 0) {
    console.log("▶ no pending migrations");
    return;
  }
  console.log(`▶ pending migrations: ${pending.map((entry) => entry.tag).join(", ")}`);
  const refused = pending
    .map((entry) => ({
      tag: entry.tag,
      kinds: destructiveChanges(readFileSync(join(MIGRATIONS, `${entry.tag}.sql`), "utf8")),
    }))
    .filter((entry) => entry.kinds.length > 0);
  if (refused.length === 0) return;
  for (const entry of refused) console.error(`   ${entry.tag}: ${entry.kinds.join(", ")}`);
  stop(
    "A pending migration is destructive. Ship it additively (add, backfill, switch the code, " +
      "remove in a later release), or — once nothing serving reads what it removes — put " +
      "`-- release:allow-destructive <reason>` in the .sql. AGENTS.md §4a."
  );
}

function migrate(url: string, target: MigrationTarget): void {
  const env: NodeJS.ProcessEnv = { ...process.env, POSTGRES_URL: url };
  // Only the production plan may lift migrate.ts's development-database guard.
  if (target === "production") env.MIGRATE_TARGET = "production";
  else delete env.MIGRATE_TARGET;

  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const run = spawnSync("pnpm", ["db:migrate"], { env, encoding: "utf8" });
    const output = `${run.stdout ?? ""}${run.stderr ?? ""}`;
    process.stdout.write(output.replace(/postgres(ql)?:\/\/[^\s"']+/g, "<redacted-url>"));
    if (run.status === 0) return;
    if (attempt === ATTEMPTS || !isConnectionFailure(output)) stop("Migration failed — the build stops here.");
    console.log(`Database not reachable yet (attempt ${attempt}/${ATTEMPTS}), retrying in ${attempt * 5}s…`);
    sleep(attempt * 5000);
  }
}

async function main(): Promise<void> {
  const plan = buildPlan({
    VERCEL_ENV: process.env.VERCEL_ENV,
    VERCEL_GIT_COMMIT_REF: process.env.VERCEL_GIT_COMMIT_REF,
  });
  console.log(`▶ build plan: gate=${plan.gate} migrate=${plan.migrate}`);

  if (plan.gate) runGate();

  if (plan.migrate !== "none") {
    const url = migrationUrl();
    checkTarget(url, plan.migrate);
    await checkPending(url);
    migrate(url, plan.migrate);
  }

  const build = spawnSync("pnpm", ["build"], { stdio: "inherit" });
  process.exit(build.status ?? 1);
}

main().catch((error) => stop(String(error).replace(/postgres(ql)?:\/\/[^\s"']+/g, "<redacted-url>")));
