import { db } from "@/db";
import {
  expedionFiles,
  type InsertExpedionFile,
} from "@/db/schema/expedion";
import { and, eq, inArray } from "drizzle-orm";

/**
 * The indirection rows behind `/api/expedion/files/<id>`.
 *
 * Kept out of `expedion.dal.ts` because nothing here is scoped to a quote: a
 * file is written before the quote exists, and is authorised against its own
 * `ownerUserId` rather than against a quote's owner.
 */
export const expedionFilesDal = {
  async create(data: InsertExpedionFile) {
    const [row] = await db.insert(expedionFiles).values(data).returning();
    return row;
  },

  async getById(id: string) {
    const [row] = await db
      .select()
      .from(expedionFiles)
      .where(eq(expedionFiles.id, id))
      .limit(1);
    return row ?? null;
  },

  /**
   * Every object key on record.
   *
   * Read by the image-cleanup sweep, which otherwise knows nothing about these
   * files and would treat each one as an orphan if the Expedion bucket were
   * ever pointed at the same bucket it sweeps.
   */
  async listObjectKeys(): Promise<string[]> {
    const rows = await db
      .select({ objectKey: expedionFiles.objectKey })
      .from(expedionFiles);
    return rows.map((r) => r.objectKey);
  },

  /**
   * Attaches uploaded files to the quote they were filed with.
   *
   * `ownerUserId` is part of the predicate, not a courtesy check around it:
   * the ids arrive from a request body, so an unscoped `WHERE id IN (…)` would
   * let anyone who knows a file id repoint that row at their own quote — and
   * detach it from its real one on the way past. Rows that do not match are
   * left untouched and unreported; there is nothing to say to a caller who
   * named a file that is not theirs.
   */
  async attachToQuote(ids: string[], quoteId: string, ownerUserId: string) {
    if (ids.length === 0) return;
    await db
      .update(expedionFiles)
      .set({ quoteId })
      .where(
        and(
          inArray(expedionFiles.id, ids),
          eq(expedionFiles.ownerUserId, ownerUserId)
        )
      );
  },
};
