import { and, desc, eq, like, lt, sql } from "drizzle-orm";

import { db } from "@/db";
import { verification } from "@/db/schema";

/**
 * Emailed access codes, kept in Better Auth's own `verification` table
 * (email_access_code_spec.md §3).
 *
 * The table is Better Auth's, so every query here is pinned to an identifier
 * this app owns (`email-verification-code:<address>`): Better Auth only ever
 * reads its own rows by their exact identifier, and these never collide with
 * them. `value` holds `{"hash","attempts"}` as JSON text — no migration, and
 * the attempt counter is bumped inside Postgres, not read-modify-written.
 */

export interface CodeRow {
  id: string;
  value: string;
  expiresAt: Date;
}

/** Writes a fresh code for `identifier`, removing whatever was there before. */
export async function replaceCode(
  identifier: string,
  row: CodeRow
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(verification).where(eq(verification.identifier, identifier));
    await tx.insert(verification).values({ ...row, identifier });
  });
}

/**
 * The newest code under `identifier`. Two issues racing can leave two rows;
 * the newest is the one the latest mail carried.
 */
export async function findLatestCode(
  identifier: string
): Promise<CodeRow | undefined> {
  const [row] = await db
    .select({
      id: verification.id,
      value: verification.value,
      expiresAt: verification.expiresAt,
    })
    .from(verification)
    .where(eq(verification.identifier, identifier))
    .orderBy(desc(verification.createdAt))
    .limit(1);
  return row;
}

/**
 * Counts one attempt against a code, atomically, and answers the row as it
 * now reads — or `null` when the row has gone (used, replaced, expired).
 *
 * Counted before the comparison and in one statement, so concurrent guesses
 * each get their own number and no more than the cap is ever compared.
 */
export async function countAttempt(id: string): Promise<string | null> {
  const [row] = await db
    .update(verification)
    .set({
      value: sql`jsonb_set(${verification.value}::jsonb, '{attempts}', to_jsonb(coalesce((${verification.value}::jsonb ->> 'attempts')::int, 0) + 1))::text`,
    })
    .where(eq(verification.id, id))
    .returning({ value: verification.value });
  return row?.value ?? null;
}

/**
 * Deletes a code. Answers whether this call is the one that deleted it, which
 * is what lets exactly one of two concurrent correct submissions win.
 */
export async function consumeCode(id: string): Promise<boolean> {
  const deleted = await db
    .delete(verification)
    .where(eq(verification.id, id))
    .returning({ id: verification.id });
  return deleted.length > 0;
}

/** Drops expired codes under `prefix`, so unverified sign-ups leave nothing behind. */
export async function purgeExpiredCodes(
  prefix: string,
  now: Date = new Date()
): Promise<void> {
  await db
    .delete(verification)
    .where(
      and(like(verification.identifier, `${prefix}%`), lt(verification.expiresAt, now))
    );
}
