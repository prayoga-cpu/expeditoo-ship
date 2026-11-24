/**
 * What a Vercel build does before it compiles — the release flow's engine
 * (AGENTS.md §4a, docs/specs/environments_spec.md §12).
 *
 *   production (main)  gate → destructive check → migrate PRODUCTION → build
 *   dev branch         gate → destructive check → migrate the dev DB → build
 *   any other preview  build only
 *
 * Production migrates itself because a launch only reaches `main` through a
 * pull request from `dev` that passed the same gate and the same migration on
 * the dev database (branch protection on `main`). Running the gate again here
 * makes it unconditional: a build that reached production some other way —
 * a CLI deploy, a protection switched off — still cannot migrate production
 * without it.
 *
 * Other previews never migrate: they share the dev database, and a pull
 * request must not be able to alter it just by being opened.
 *
 * Not the only boundary: `src/db/migrate.ts` refuses any target that is not an
 * allow-listed development database unless MIGRATE_TARGET=production, which
 * only the production plan sets.
 */
export const DEV_BRANCH = "dev";

export interface BuildEnv {
  VERCEL_ENV?: string;
  VERCEL_GIT_COMMIT_REF?: string;
}

export type MigrationTarget = "none" | "dev" | "production";

export interface BuildPlan {
  gate: boolean;
  migrate: MigrationTarget;
}

export function buildPlan(env: BuildEnv): BuildPlan {
  if (env.VERCEL_ENV === "production") {
    return { gate: true, migrate: "production" };
  }
  if (env.VERCEL_ENV === "preview" && env.VERCEL_GIT_COMMIT_REF === DEV_BRANCH) {
    return { gate: true, migrate: "dev" };
  }
  return { gate: false, migrate: "none" };
}

/** The gate, in the order it runs: cheapest first. `pnpm <script>` each. */
export const GATE_SCRIPTS: readonly string[] = [
  "changelog:check",
  "typecheck",
  "lint",
  "test",
];

/**
 * The environment the gate runs in: the toolchain and nothing else.
 *
 * A production build holds live keys — Stripe, Resend, OpenAI, the database.
 * The tests are written for CI, which has none, and one unmocked call with a
 * live key would send a real email or touch real data. So the gate gets an
 * allow-list, never the build's environment minus a deny-list.
 */
const GATE_ENV_KEYS = [
  "PATH",
  "HOME",
  "TMPDIR",
  "LANG",
  "LC_ALL",
  "TZ",
  "PNPM_HOME",
  "COREPACK_HOME",
  "XDG_CACHE_HOME",
  "XDG_CONFIG_HOME",
  "XDG_DATA_HOME",
] as const;

export type EnvRecord = Record<string, string | undefined>;

export function gateEnv(env: EnvRecord): EnvRecord {
  const clean: EnvRecord = {
    CI: "1",
    NODE_OPTIONS: "--max-old-space-size=8192",
  };
  for (const key of GATE_ENV_KEYS) {
    if (env[key] !== undefined) clean[key] = env[key];
  }
  return clean;
}

export interface JournalEntry {
  tag: string;
  when: number;
}

/**
 * The migrations a run will apply. Drizzle's migrator applies a journal entry
 * when its `when` is later than the newest `created_at` already recorded — so
 * that is the comparison, not a set difference (a backdated entry is skipped,
 * which `migrations-journal.test.ts` already refuses).
 */
export function pendingMigrations(
  entries: readonly JournalEntry[],
  lastAppliedWhen: number | null
): JournalEntry[] {
  if (lastAppliedWhen === null) return [...entries];
  return entries.filter((entry) => entry.when > lastAppliedWhen);
}

/**
 * Written in a migration's `.sql` to say a destructive statement is meant:
 *
 *   -- release:allow-destructive the code stopped reading `foo` in 2.97.0
 *
 * The reason is required. It is the record of why production lost something.
 */
export const ALLOW_DESTRUCTIVE = /^[ \t]*--[ \t]*release:allow-destructive[ \t]+\S/m;

/**
 * Statements that lose data or break the code still serving while a release
 * rolls out. Migrations here are additive by default — add, backfill, switch
 * the code, and only then remove, in a later release.
 */
const DESTRUCTIVE: ReadonlyArray<{ label: string; test: (sql: string) => boolean }> = [
  { label: "DROP TABLE", test: (s) => /\bDROP\s+TABLE\b/i.test(s) },
  { label: "DROP COLUMN", test: (s) => /\bDROP\s+COLUMN\b/i.test(s) },
  { label: "DROP SCHEMA", test: (s) => /\bDROP\s+SCHEMA\b/i.test(s) },
  { label: "DROP TYPE", test: (s) => /\bDROP\s+TYPE\b/i.test(s) },
  { label: "TRUNCATE", test: (s) => /\bTRUNCATE\b/i.test(s) },
  { label: "DELETE FROM", test: (s) => /\bDELETE\s+FROM\b/i.test(s) },
  { label: "RENAME", test: (s) => /\bRENAME\s+(COLUMN\b|TO\b)/i.test(s) },
  { label: "ALTER COLUMN … TYPE", test: (s) => /\bALTER\s+COLUMN\s+\S+\s+(SET\s+DATA\s+)?TYPE\b/i.test(s) },
  { label: "SET NOT NULL", test: (s) => /\bSET\s+NOT\s+NULL\b/i.test(s) },
  {
    label: "ADD COLUMN … NOT NULL without DEFAULT",
    test: (s) => /\bADD\s+COLUMN\b/i.test(s) && /\bNOT\s+NULL\b/i.test(s) && !/\bDEFAULT\b/i.test(s),
  },
];

function stripComments(sql: string): string {
  return sql.replace(/--[^\n]*/g, "");
}

/** The destructive kinds found in a migration — empty when none, or when allowed. */
export function destructiveChanges(sql: string): string[] {
  if (ALLOW_DESTRUCTIVE.test(sql)) return [];
  const statements = stripComments(sql)
    .split(/;|-->\s*statement-breakpoint/i)
    .map((statement) => statement.trim())
    .filter(Boolean);
  const found = new Set<string>();
  for (const statement of statements) {
    for (const rule of DESTRUCTIVE) {
      if (rule.test(statement)) found.add(rule.label);
    }
  }
  return [...found];
}

/**
 * A failure worth a second attempt: the database could not be reached.
 *
 * Neon suspends an idle compute, and the first connection of a build can
 * arrive while it is still waking. A migration that reached the database and
 * was refused — bad SQL, a guard, a lock — is not retried: it would fail the
 * same way, and its message is the one that matters.
 */
export function isConnectionFailure(output: string): boolean {
  return /ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|CONNECT_TIMEOUT|CONNECTION_CLOSED|CONNECTION_ENDED/.test(
    output
  );
}
