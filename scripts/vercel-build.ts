/**
 * The Vercel build command (`vercel.json` → `pnpm build:vercel`).
 *
 * On every deployment but one this is `next build` and nothing else. On the
 * `dev` branch it applies pending migrations to the development database
 * first, so `dev.expeditop.fr` never serves code ahead of its schema. Why only
 * there: `src/lib/build-migrate.ts`.
 *
 * A failed migration fails the build. The previous deployment keeps serving,
 * which is the right outcome — new code on an old schema is the 500 this
 * exists to prevent.
 */
import { spawnSync } from "node:child_process";

import {
  isConnectionFailure,
  shouldMigrateOnBuild,
} from "../src/lib/build-migrate";

const ATTEMPTS = 4;

function sleep(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function migrate(): void {
  // DDL wants the direct endpoint: Neon's pooler is PgBouncer in transaction
  // mode. `migrate.ts` reads POSTGRES_URL, so hand it the unpooled one here.
  const env = {
    ...process.env,
    POSTGRES_URL:
      process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL,
  };

  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const run = spawnSync("pnpm", ["db:migrate"], { env, encoding: "utf8" });
    const output = `${run.stdout ?? ""}${run.stderr ?? ""}`;
    process.stdout.write(output);

    if (run.status === 0) return;

    if (attempt === ATTEMPTS || !isConnectionFailure(output)) {
      console.error("❌ Migration failed — the build stops here.");
      process.exit(run.status ?? 1);
    }

    console.log(
      `Database not reachable yet (attempt ${attempt}/${ATTEMPTS}), retrying in ${attempt * 5}s…`
    );
    sleep(attempt * 5000);
  }
}

if (
  shouldMigrateOnBuild({
    VERCEL_ENV: process.env.VERCEL_ENV,
    VERCEL_GIT_COMMIT_REF: process.env.VERCEL_GIT_COMMIT_REF,
  })
) {
  console.log("▶ dev branch: applying migrations before the build");
  migrate();
}

const build = spawnSync("pnpm", ["build"], { stdio: "inherit" });
process.exit(build.status ?? 1);
