/**
 * ============================================================================
 * Re-split Expedion buyer names that were stored the wrong way round
 * ============================================================================
 *
 *   pnpm tsx src/scripts/backfill-expedion-names.ts             # dry run
 *   pnpm tsx src/scripts/backfill-expedion-names.ts --execute   # write
 *
 * The problem
 * -----------
 *
 * Until 2026-08-26, `toQuotePatch` split the extracted `buyerName` on the first
 * space and called the first token the given name:
 *
 *     const [firstName, ...rest] = (extraction.buyerName ?? "").split(" ");
 *
 * A French bordereau prints "DUPONT Jean" at least as often as "M. Jean
 * DUPONT", so a large share of rows have the surname sitting in `first_name`
 * and the given name in `last_name`. Nothing ever showed those two columns to
 * the client, so nobody could see it happen.
 *
 * `parseFrenchName` now infers the order from capitalisation instead, and the
 * confirm-details screen shows both fields — which means these rows are about
 * to become visible for the first time, backwards.
 *
 * Why this is recoverable at all
 * ------------------------------
 *
 * The raw model output is kept: `expedion_quotes.extraction` is jsonb written
 * by both extraction call sites, and the schema comment at
 * `src/db/schema/expedion.ts` says it exists so a bad extraction can be
 * audited. `extraction->>'buyerName'` is the original string, so the split can
 * simply be re-run. No information was destroyed, only mis-filed.
 *
 * What it deliberately will not touch
 * -----------------------------------
 *
 * A row is skipped when the stored name does not match what the OLD code would
 * have produced from that same `buyerName`. That is the signal that a human
 * corrected it by hand on the confirm screen, and a hand correction outranks
 * anything this script can infer. Rows with no `extraction` are skipped too:
 * without the original there is nothing to re-split, and guessing from the
 * stored halves would just re-apply the bug.
 */

import "dotenv/config";
import { db } from "@/db";
import { expedionQuotes } from "@/db/schema/expedion";
import { isNotNull, sql } from "drizzle-orm";
import { parseFrenchName } from "@/lib/french-names";

const EXECUTE = process.argv.includes("--execute");

/** Exactly what the pre-2026-08-26 code produced, so we can recognise its work. */
function legacySplit(buyerName: string) {
  const [first, ...rest] = buyerName.split(" ");
  return { firstName: first || null, lastName: rest.join(" ") || null };
}

async function main() {
  console.log(
    EXECUTE
      ? "Re-splitting Expedion buyer names (WRITING)."
      : "Re-splitting Expedion buyer names (dry run — pass --execute to write)."
  );

  const rows = await db
    .select({
      id: expedionQuotes.id,
      firstName: expedionQuotes.firstName,
      lastName: expedionQuotes.lastName,
      buyerName: sql<string | null>`${expedionQuotes.extraction}->>'buyerName'`,
    })
    .from(expedionQuotes)
    .where(isNotNull(expedionQuotes.extraction));

  console.log(`${rows.length} quote(s) carry a stored extraction.\n`);

  let corrected = 0;
  let alreadyRight = 0;
  let handEdited = 0;
  let noName = 0;

  for (const row of rows) {
    const buyerName = row.buyerName?.trim();
    if (!buyerName) {
      noName++;
      continue;
    }

    const legacy = legacySplit(buyerName);
    const touchedByHand =
      row.firstName !== legacy.firstName || row.lastName !== legacy.lastName;
    if (touchedByHand) {
      handEdited++;
      continue;
    }

    const parsed = parseFrenchName(buyerName);
    if (
      parsed.firstName === row.firstName &&
      parsed.lastName === row.lastName
    ) {
      alreadyRight++;
      continue;
    }

    corrected++;
    console.log(
      `  ${row.id}  "${buyerName}"\n` +
        `      was  ${JSON.stringify(row.firstName)} / ${JSON.stringify(row.lastName)}\n` +
        `      now  ${JSON.stringify(parsed.firstName)} / ${JSON.stringify(parsed.lastName)}`
    );

    if (EXECUTE) {
      await db
        .update(expedionQuotes)
        .set({ firstName: parsed.firstName, lastName: parsed.lastName })
        .where(sql`${expedionQuotes.id} = ${row.id}`);
    }
  }

  console.log("");
  console.log("=".repeat(72));
  console.log(`  ${corrected} row(s) ${EXECUTE ? "corrected" : "would be corrected"}`);
  console.log(`  ${alreadyRight} already agreed with the new parser`);
  console.log(`  ${handEdited} left alone — a person had edited them`);
  console.log(`  ${noName} had no buyerName in the extraction`);
  console.log("=".repeat(72));

  process.exit(0);
}

main().catch((error) => {
  console.error("\nBackfill failed:", error);
  process.exit(1);
});
