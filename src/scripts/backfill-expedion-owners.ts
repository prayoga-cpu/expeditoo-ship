/**
 * ============================================================================
 * Re-home Expedion quotes that no signed-in account can currently see
 * ============================================================================
 *
 *   pnpm tsx src/scripts/backfill-expedion-owners.ts             # dry run
 *   pnpm tsx src/scripts/backfill-expedion-owners.ts --execute   # write
 *
 * The problem
 * -----------
 *
 * `expedion_quotes.firebase_uid` is the ownership column — every read path the
 * Flutter client has filters on it. It currently holds three different kinds of
 * value, only one of which is resolvable now that Expedion signs in through
 * Better Auth:
 *
 *   - a Better Auth `user.id`, on everything created since the cutover;
 *   - a raw Firebase UID, on the rows that predate it (48 legacy accounts, all
 *     password-only, only 4 of them with a verified address);
 *   - `airtable:<recordId>`, on roughly 4,450 of the 4,591 rows the one-time
 *     Airtable import brought across, because those records carried no UID
 *     column at all (see src/scripts/import-airtable-quotes.ts).
 *
 * The last two are invisible: no session will ever present an id that matches
 * them, so the quote exists, is priced, is paid, and shows up for nobody.
 *
 * Why this exists when the runtime hook already does it
 * ----------------------------------------------------
 *
 * `claimExpedionQuotesForUser` in src/server/services/auth.service.ts runs on
 * every session creation and re-homes a person's legacy rows the moment they
 * sign in with a verified address. That covers everybody who comes back.
 *
 * It does not cover anybody who does not come back, and — the reason this
 * script is worth having at all — it cannot tell you in advance how many that
 * is. A hook that fires one account at a time can never answer "how much of the
 * table is unreachable?", and that number is what the next phase needs. So this
 * is both the sweep and the census: it applies the same rules in bulk, and it
 * counts what those rules cannot reach.
 *
 * The rule
 * --------
 *
 * A quote is re-homed onto a Better Auth account only when the account's
 * address is **verified**. Email is the sole identifier the two systems share,
 * and an unverified address is not evidence of anything: anyone can type
 * somebody else's address into a signup form, and handing them that person's
 * quote history — names, delivery addresses, phone numbers, declared values —
 * on the strength of it would be a data breach rather than a migration. So an
 * unverified match is counted as UNMATCHED and left alone.
 *
 * That is deliberately the same rule, expressed the same way (a NOT EXISTS
 * against the user table, not a pattern match on the id), as the runtime hook
 * uses. If the two ever disagree about who owns a row, a quote changes hands
 * depending on which code path touched it last, so they are kept identical on
 * purpose — change one and change the other.
 *
 * Design notes
 * ------------
 *
 *   - Dry run is the default, and `--execute` is the only way to write, for the
 *     same reason the Airtable import works that way: half-reassigning
 *     ownership across a production table is far worse than running the report
 *     twice.
 *   - Re-runnable. The only rows it considers are those whose `firebase_uid`
 *     does not already resolve to a live Better Auth user, so a row it claimed
 *     on a previous run is out of scope on the next one. The same guard is
 *     re-asserted inside the UPDATE, so a row somebody's sign-in claimed in the
 *     seconds between planning and writing is skipped rather than clobbered.
 *   - The UNMATCHED count is the number that matters. It is the population that
 *     cannot be reached by email at all, and it is the input to the later phase
 *     that decides what to do with them (invite, merge by hand, or accept that
 *     they stay archival), so it is printed last and loudest.
 */

import "dotenv/config";
import { db } from "@/db";
import { expedionQuotes } from "@/db/schema/expedion";
import { user } from "@/db/schema/users";
import { alias } from "drizzle-orm/pg-core";
import { and, eq, exists, inArray, not, sql } from "drizzle-orm";

// ========================================
// Config
// ========================================

const EXECUTE = process.argv.includes("--execute");

/** Rows per UPDATE. Bounded so one statement cannot blow the parameter limit. */
const CHUNK = 200;

// ========================================
// Classification
// ========================================

/**
 * Why a legacy row did or did not find an owner. Ordered from "fixable now" to
 * "needs a human", because that is the order the report reads in.
 */
type Reason =
  | "claimable"
  | "no_email_on_quote"
  | "no_account_for_address"
  | "account_exists_but_unverified";

const REASON_LABELS: Record<Reason, string> = {
  claimable: "a verified Better Auth account owns this address",
  no_email_on_quote: "the quote carries no email address at all",
  no_account_for_address: "nobody has ever signed up with that address",
  account_exists_but_unverified:
    "an account exists but has never verified the address — deliberately NOT claimed",
};

/** Which flavour of unresolvable id the row carries, for the report only. */
type LegacyKind = "airtable_import" | "firebase_uid";

interface PlannedRow {
  quoteId: string;
  firebaseUid: string;
  quoteEmail: string | null;
  legacyKind: LegacyKind;
  reason: Reason;
  /** Only set when `reason` is "claimable". */
  targetUserId: string | null;
  targetEmail: string | null;
}

// ========================================
// Planning
// ========================================

/**
 * Every quote whose `firebase_uid` does not resolve to a live Better Auth user,
 * left-joined to the account that owns its email address.
 *
 * The join is on the address alone, *not* on `email_verified`. Verification is
 * evaluated afterwards, in JS, so that "an account exists but is unverified"
 * stays distinguishable from "no account exists" — those two need completely
 * different follow-up, and folding the flag into the join would report both as
 * the same silence.
 *
 * Addresses are compared lower-cased and trimmed on both sides, matching what
 * `claimExpedionQuotesForUser` does, because the Airtable export is
 * hand-typed and its casing and padding cannot be trusted.
 *
 * One row out means one row back, which rests on `user.email` being unique
 * (src/db/schema/users.ts) and on Better Auth lower-casing an address before it
 * stores it. If two accounts ever did hold the same address in different cases,
 * this join would fan that quote out into two planned rows and every count in
 * the report would be inflated by the duplicates. The write path survives it
 * either way -- the second UPDATE finds the row already owned and skips it --
 * but the census, which is the reason this script exists, would be quietly
 * wrong. If the numbers below ever exceed the row count of the table, that is
 * the explanation to check first.
 */
async function planRows(): Promise<PlannedRow[]> {
  const owner = alias(user, "owner");

  const rows = await db
    .select({
      quoteId: expedionQuotes.id,
      firebaseUid: expedionQuotes.firebaseUid,
      quoteEmail: expedionQuotes.email,
      matchedUserId: user.id,
      matchedEmail: user.email,
      matchedEmailVerified: user.emailVerified,
    })
    .from(expedionQuotes)
    .leftJoin(
      user,
      sql`lower(trim(${user.email})) = lower(trim(${expedionQuotes.email}))`
    )
    .where(
      // The definition of "legacy": the owner column holds something that is
      // not a Better Auth user id. Expressed as a lookup rather than a pattern
      // match on the string, because the shapes of a Firebase UID and a Better
      // Auth id are similar enough that any regex would eventually be wrong,
      // and being wrong here means reassigning a live customer's quote.
      not(
        exists(
          db
            .select({ one: sql`1` })
            .from(owner)
            .where(eq(owner.id, expedionQuotes.firebaseUid))
        )
      )
    );

  return rows.map((row) => {
    const legacyKind: LegacyKind = row.firebaseUid.startsWith("airtable:")
      ? "airtable_import"
      : "firebase_uid";

    let reason: Reason;
    if (!row.quoteEmail || row.quoteEmail.trim() === "") {
      reason = "no_email_on_quote";
    } else if (!row.matchedUserId) {
      reason = "no_account_for_address";
    } else if (!row.matchedEmailVerified) {
      reason = "account_exists_but_unverified";
    } else {
      reason = "claimable";
    }

    return {
      quoteId: row.quoteId,
      firebaseUid: row.firebaseUid,
      quoteEmail: row.quoteEmail,
      legacyKind,
      reason,
      targetUserId: reason === "claimable" ? row.matchedUserId : null,
      targetEmail: reason === "claimable" ? row.matchedEmail : null,
    };
  });
}

// ========================================
// Writing
// ========================================

/**
 * Applies the plan, grouped by destination account so each statement moves one
 * person's quotes.
 *
 * The `not exists` guard from the plan is repeated in the WHERE clause. It is
 * not redundant: `claimExpedionQuotesForUser` fires on every session creation,
 * so a row can acquire a real owner in the gap between reading the plan and
 * writing it — a gap measured in minutes when the plan spans thousands of rows.
 * Re-asserting the guard turns that race into a skipped row instead of an
 * overwrite, and is also what makes a second run of this script a no-op.
 */
async function applyPlan(claimable: PlannedRow[]): Promise<number> {
  const byUser = new Map<string, string[]>();
  for (const row of claimable) {
    if (!row.targetUserId) continue;
    const ids = byUser.get(row.targetUserId) ?? [];
    ids.push(row.quoteId);
    byUser.set(row.targetUserId, ids);
  }

  const owner = alias(user, "owner");
  let written = 0;

  for (const [targetUserId, quoteIds] of byUser) {
    for (let i = 0; i < quoteIds.length; i += CHUNK) {
      const chunk = quoteIds.slice(i, i + CHUNK);
      const updated = await db
        .update(expedionQuotes)
        // `userId` is set alongside `firebaseUid` so the forward-looking
        // foreign key and the column every read path actually filters on can
        // never disagree about who owns the row. `updatedAt` is stamped by the
        // schema's `$onUpdate`.
        .set({ firebaseUid: targetUserId, userId: targetUserId })
        .where(
          and(
            inArray(expedionQuotes.id, chunk),
            not(
              exists(
                db
                  .select({ one: sql`1` })
                  .from(owner)
                  .where(eq(owner.id, expedionQuotes.firebaseUid))
              )
            )
          )
        )
        .returning({ id: expedionQuotes.id });

      written += updated.length;
      process.stdout.write(`\r  reassigned ${written}/${claimable.length}…`);
    }
  }

  process.stdout.write("\n");
  return written;
}

// ========================================
// Reporting
// ========================================

function tally<T extends string>(rows: PlannedRow[], key: (row: PlannedRow) => T) {
  const counts = new Map<T, number>();
  for (const row of rows) counts.set(key(row), (counts.get(key(row)) ?? 0) + 1);
  return counts;
}

function pct(part: number, whole: number): string {
  if (whole === 0) return "—";
  return `${((part / whole) * 100).toFixed(1)}%`;
}

// ========================================
// Main
// ========================================

async function main() {
  console.log("Expedion — re-home quotes onto verified Better Auth accounts");
  console.log(
    `  mode   ${
      EXECUTE
        ? "*** EXECUTE — THIS RUN WILL WRITE TO expedion_quotes ***"
        : "DRY RUN — nothing will be written (pass --execute to apply)"
    }`
  );
  console.log("");

  const totalQuotes = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(expedionQuotes)
    .then(([r]) => r.n);

  console.log("Planning…");
  const planned = await planRows();

  const claimable = planned.filter((row) => row.reason === "claimable");
  const unmatched = planned.filter((row) => row.reason !== "claimable");

  const byReason = tally(planned, (row) => row.reason);
  const byKind = tally(planned, (row) => row.legacyKind);
  const distinctTargets = new Set(claimable.map((row) => row.targetUserId)).size;

  console.log("");
  console.log("Population");
  console.log(`  rows in expedion_quotes                    : ${totalQuotes}`);
  console.log(
    `  legacy rows (firebase_uid is not a user.id): ${planned.length} ` +
      `(${pct(planned.length, totalQuotes)} of the table)`
  );
  console.log(
    `    of which imported from Airtable          : ${byKind.get("airtable_import") ?? 0}`
  );
  console.log(
    `    of which raw legacy Firebase UIDs        : ${byKind.get("firebase_uid") ?? 0}`
  );

  console.log("");
  console.log("Outcome");
  console.log(
    `  WOULD BE CLAIMED                           : ${claimable.length} ` +
      `(${pct(claimable.length, planned.length)}), across ${distinctTargets} account(s)`
  );
  console.log(
    `  UNMATCHED                                  : ${unmatched.length} ` +
      `(${pct(unmatched.length, planned.length)})`
  );

  console.log("");
  console.log("Breakdown by reason");
  for (const reason of Object.keys(REASON_LABELS) as Reason[]) {
    const count = byReason.get(reason) ?? 0;
    console.log(`  ${String(count).padStart(6)}  ${reason.padEnd(30)} ${REASON_LABELS[reason]}`);
  }

  if (claimable.length > 0) {
    console.log("");
    console.log("Sample of what would move (up to 5):");
    for (const row of claimable.slice(0, 5)) {
      console.log(
        `  ${row.quoteId}  ${row.firebaseUid} → ${row.targetUserId}  (${row.targetEmail})`
      );
    }
  }

  if (!EXECUTE) {
    console.log("");
    console.log(
      `Dry run — nothing written. Re-run with --execute to reassign ${claimable.length} row(s).`
    );
  } else if (claimable.length === 0) {
    console.log("");
    console.log("Nothing to do — no legacy row resolves to a verified account.");
  } else {
    console.log("");
    console.log("Writing…");
    const written = await applyPlan(claimable);

    // A shortfall is not an error: the guard clause skips any row that acquired
    // a real owner since the plan was read, which is exactly what it is for. It
    // is reported anyway so the number is never a surprise.
    if (written !== claimable.length) {
      console.log(
        `  note: ${claimable.length - written} row(s) were claimed by someone ` +
          `else between planning and writing and were left alone.`
      );
    }
    console.log(`Reassigned ${written} row(s).`);
  }

  // Printed last, on purpose. Everything above is progress; this is the number
  // that decides whether the next phase is needed and how big it is.
  console.log("");
  console.log("=".repeat(72));
  console.log(
    `  UNMATCHED: ${unmatched.length} Expedion quote(s) still belong to nobody ` +
      `reachable.`
  );
  console.log(
    "  No verified Better Auth account holds their address, so no amount of " +
      "re-running"
  );
  console.log(
    "  this script will claim them. They need the next phase: an invite " +
      "campaign, a"
  );
  console.log("  manual merge, or a decision that they stay archival.");
  console.log("=".repeat(72));

  process.exit(0);
}

main().catch((error) => {
  console.error("\nBackfill failed:", error);
  process.exit(1);
});
