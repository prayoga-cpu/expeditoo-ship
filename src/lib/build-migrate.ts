/**
 * Whether a Vercel build applies migrations before it compiles.
 *
 * Only the `dev` branch does. Its deployment is `dev.expeditop.fr`, backed by
 * the development database, and a schema that lags the code there is a broken
 * page for whoever is testing — so the build that ships the code also ships
 * the schema.
 *
 * Production never does, deliberately: migrations in this repo are
 * hand-written, and applying one to real data is a decision someone takes by
 * running `.github/workflows/migrate.yml` and reading its output. Other
 * preview branches do not either — they share the dev database, and a pull
 * request must not be able to alter it just by being opened.
 *
 * This is not the safety boundary. `src/db/migrate.ts` refuses any target that
 * is not an allow-listed development database, so a `dev` build handed the
 * production URL fails rather than migrates. See
 * docs/specs/environments_spec.md §10.
 */
export const MIGRATED_BRANCH = "dev";

export interface BuildEnv {
  VERCEL_ENV?: string;
  VERCEL_GIT_COMMIT_REF?: string;
}

export function shouldMigrateOnBuild(env: BuildEnv): boolean {
  return (
    env.VERCEL_ENV === "preview" &&
    env.VERCEL_GIT_COMMIT_REF === MIGRATED_BRANCH
  );
}

/**
 * A failure worth a second attempt: the database could not be reached.
 *
 * Neon suspends an idle development compute, and the first connection of a
 * build can arrive while it is still waking. A migration that reached the
 * database and was refused — bad SQL, a guard, a lock — is not retried: it
 * would fail the same way, and its message is the one that matters.
 */
export function isConnectionFailure(output: string): boolean {
  return /ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|CONNECT_TIMEOUT|CONNECTION_CLOSED|CONNECTION_ENDED/.test(
    output
  );
}
