import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The journal is the migration list; the directory is not.
 *
 * `drizzle-kit`'s migrator reads `_journal.json` and applies the file each
 * entry names. A `.sql` file nobody registered is inert — it sits in the repo,
 * passes review, gets applied by hand on a laptop, and never reaches
 * production. That is exactly what happened to `withdrawals` and
 * `offer_self_accepted`: both shipped unregistered, so the deployed database
 * had no `withdrawals` table, `GET /api/carrier/withdrawals` answered 500, and
 * "My earnings" was a blank page nobody could explain from the code.
 *
 * Ordering is checked for the same reason. Drizzle applies a migration only
 * when its journal `when` is greater than the newest timestamp the database
 * has already recorded, so a new entry backdated below the last applied one is
 * silently skipped — the same failure wearing a different hat.
 */
const MIGRATIONS_DIR = join(__dirname, "..", "migrations");

interface JournalEntry {
  idx: number;
  when: number;
  tag: string;
}

function journal(): JournalEntry[] {
  const raw = readFileSync(join(MIGRATIONS_DIR, "meta", "_journal.json"), "utf8");
  return (JSON.parse(raw) as { entries: JournalEntry[] }).entries;
}

function sqlFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .map((name) => name.replace(/\.sql$/, ""))
    .sort();
}

describe("migration journal", () => {
  it("registers every .sql file in the migrations folder", () => {
    const registered = new Set(journal().map((e) => e.tag));
    const orphans = sqlFiles().filter((tag) => !registered.has(tag));

    expect(orphans).toEqual([]);
  });

  it("names only files that exist", () => {
    const present = new Set(sqlFiles());
    const missing = journal()
      .map((e) => e.tag)
      .filter((tag) => !present.has(tag));

    expect(missing).toEqual([]);
  });

  it("has a strictly increasing timestamp, so nothing is skipped", () => {
    const whens = journal().map((e) => e.when);

    expect(whens).toEqual([...whens].sort((a, b) => a - b));
    expect(new Set(whens).size).toBe(whens.length);
  });

  it("numbers entries contiguously from zero", () => {
    expect(journal().map((e) => e.idx)).toEqual(
      journal().map((_, index) => index)
    );
  });

  it("gives each migration a unique numeric prefix", () => {
    const prefixes = sqlFiles().map((tag) => tag.slice(0, 4));

    expect(new Set(prefixes).size).toBe(prefixes.length);
  });
});
