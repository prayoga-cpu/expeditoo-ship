/**
 * One-off runner for `src/db/migrations/0002_realign_transport_schema.sql`.
 *
 * DESTRUCTIVE. It drops and rebuilds `listings`, `shipments` and `payments`,
 * and drops seven v1 tables the schema no longer defines. Everything runs
 * inside one transaction, so a failure at any statement rolls the whole thing
 * back and leaves the database exactly as it was.
 *
 * Why not `pnpm db:migrate`: the database's drizzle journal records six
 * migrations from the pre-squash history, none of whose hashes match the repo's
 * `0000_old_slayback`. Drizzle would therefore try to replay 0000 and abort on
 * "relation listings already exists". Once this has landed, reconcile the
 * journal (see the note printed on success) and db:migrate works normally.
 *
 * Run with the env loaded — tsx does not read .env.local by itself:
 *
 *   set -a; . ./.env.local; set +a
 *   npx tsx scripts/apply-realign-migration.ts
 */

import * as fs from "fs";
import { sql } from "drizzle-orm";
import { db } from "@/db";

const MIGRATION = "src/db/migrations/0002_realign_transport_schema.sql";

/** A chunk is a statement only if it has a line that is not a comment. */
function isStatement(chunk: string): boolean {
  return chunk
    .split("\n")
    .some((line) => line.trim() && !line.trim().startsWith("--"));
}

function firstCodeLine(chunk: string): string {
  return (
    chunk
      .split("\n")
      .find((line) => line.trim() && !line.trim().startsWith("--"))
      ?.slice(0, 68) ?? ""
  );
}

async function main() {
  const statements = fs
    .readFileSync(MIGRATION, "utf8")
    .split(";--> statement-breakpoint")
    .map((s) => s.trim().replace(/;$/, "").trim())
    .filter(isStatement);

  console.log(`Applying ${statements.length} statements in one transaction…\n`);

  await db.transaction(async (tx) => {
    for (const [i, statement] of statements.entries()) {
      const n = String(i + 1).padStart(2);
      try {
        await tx.execute(sql.raw(statement));
        console.log(`  ${n}. ok    ${firstCodeLine(statement)}`);
      } catch (error) {
        console.error(`  ${n}. FAIL  ${firstCodeLine(statement)}`);
        console.error(`        ${(error as Error).message}`);
        throw error;
      }
    }
  });

  console.log("\nCommitted.\n");
  console.log("Next: reconcile the drizzle journal so `pnpm db:migrate` stops");
  console.log("trying to replay 0000, then delete this script.");
  process.exit(0);
}

main().catch(() => {
  console.error("\nRolled back — the database is unchanged.");
  process.exit(1);
});
