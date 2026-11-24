import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { account } from "@/db/schema";

/**
 * Remove a user's email-and-password sign-in (Better Auth's `credential`
 * account), leaving every other way in. Answers how many rows went.
 */
export async function deleteCredentialAccounts(userId: string): Promise<number> {
  const deleted = await db
    .delete(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, "credential")))
    .returning({ id: account.id });

  return deleted.length;
}
