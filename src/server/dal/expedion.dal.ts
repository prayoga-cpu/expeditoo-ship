import { db } from "@/db";
import {
  expedionQuotes,
  expedionQuoteEvents,
  type InsertExpedionQuote,
  type InsertExpedionQuoteEvent,
  type ExpedionQuoteStatus,
} from "@/db/schema/expedion";
import { and, asc, desc, eq, ilike, lte, isNull, sql, count } from "drizzle-orm";

type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Whose quotes a list call is asking for.
 *
 * A discriminated union rather than an optional `firebaseUid`, because the two
 * meanings the optional field conflated — "this owner" and "every owner" — are
 * exactly the bug it caused: the route passed `undefined` for admins, the DAL
 * read that as "no predicate", and the *client* app was served the whole table.
 *
 * Now the caller has to say which it wants. Omitting it does not compile.
 */
export type QuoteOwnerScope =
  | { scope: "mine"; ownerId: string }
  /** Every owner. Only ever legitimate on an operator surface. */
  | { scope: "all" };

export interface QuoteFilters {
  owner: QuoteOwnerScope;
  status?: ExpedionQuoteStatus;
  bordereauNumber?: string;
  pickupCity?: string;
  page: number;
  limit: number;
}

export const expedionDal = {
  async create(data: InsertExpedionQuote, tx: Executor = db) {
    const [row] = await tx.insert(expedionQuotes).values(data).returning();
    return row;
  },

  async getById(id: string, tx: Executor = db) {
    return await tx.query.expedionQuotes.findFirst({
      where: eq(expedionQuotes.id, id),
      with: { events: { orderBy: asc(expedionQuoteEvents.createdAt) } },
    });
  },

  async getByListingId(listingId: string, tx: Executor = db) {
    return await tx.query.expedionQuotes.findFirst({
      where: eq(expedionQuotes.listingId, listingId),
    });
  },

  async getByAirtableRecordId(recordId: string, tx: Executor = db) {
    return await tx.query.expedionQuotes.findFirst({
      where: eq(expedionQuotes.airtableRecordId, recordId),
    });
  },

  async list(filters: QuoteFilters, tx: Executor = db) {
    const where = and(
      ...[
        filters.owner.scope === "mine"
          ? eq(expedionQuotes.firebaseUid, filters.owner.ownerId)
          : undefined,
        filters.status ? eq(expedionQuotes.status, filters.status) : undefined,
        filters.bordereauNumber
          ? ilike(
              expedionQuotes.bordereauNumber,
              `%${filters.bordereauNumber}%`
            )
          : undefined,
        filters.pickupCity
          ? ilike(expedionQuotes.pickupCity, `%${filters.pickupCity}%`)
          : undefined,
      ].filter(Boolean)
    );

    const [rows, [{ total }]] = await Promise.all([
      tx
        .select()
        .from(expedionQuotes)
        .where(where)
        .orderBy(desc(expedionQuotes.createdAt))
        .limit(filters.limit)
        .offset((filters.page - 1) * filters.limit),
      tx.select({ total: count() }).from(expedionQuotes).where(where),
    ]);

    return { rows, total: Number(total) };
  },

  async update(
    id: string,
    data: Partial<InsertExpedionQuote>,
    tx: Executor = db
  ) {
    const [row] = await tx
      .update(expedionQuotes)
      .set(data)
      .where(eq(expedionQuotes.id, id))
      .returning();
    return row;
  },

  /**
   * Quotes whose auto-escalate window has elapsed with no driver assigned.
   * Driven by the cron sweep; `escalatedAt is null` keeps it idempotent if a
   * run overlaps the previous one.
   */
  async findDueForEscalation(now: Date, limit = 50, tx: Executor = db) {
    return await tx
      .select()
      .from(expedionQuotes)
      .where(
        and(
          eq(expedionQuotes.status, "paid"),
          isNull(expedionQuotes.assignedCarrierId),
          isNull(expedionQuotes.escalatedAt),
          isNull(expedionQuotes.listingId),
          lte(expedionQuotes.escalateAfter, now)
        )
      )
      .orderBy(asc(expedionQuotes.escalateAfter))
      .limit(limit);
  },

  /**
   * Claims a quote for escalation. The `escalated_at is null` predicate is the
   * lock: two overlapping cron runs race here and exactly one gets the row.
   */
  async claimForEscalation(id: string, now: Date, tx: Executor = db) {
    const [row] = await tx
      .update(expedionQuotes)
      .set({ escalatedAt: now })
      .where(
        and(eq(expedionQuotes.id, id), isNull(expedionQuotes.escalatedAt))
      )
      .returning();
    return row ?? null;
  },

  async addEvent(data: InsertExpedionQuoteEvent, tx: Executor = db) {
    const [row] = await tx.insert(expedionQuoteEvents).values(data).returning();
    return row;
  },

  async listEvents(quoteId: string, tx: Executor = db) {
    return await tx
      .select()
      .from(expedionQuoteEvents)
      .where(eq(expedionQuoteEvents.quoteId, quoteId))
      .orderBy(asc(expedionQuoteEvents.createdAt));
  },

  /** Row count, used by the import script's verification step. */
  async countAll(tx: Executor = db) {
    const [{ total }] = await tx
      .select({ total: count() })
      .from(expedionQuotes);
    return Number(total);
  },

  async countImported(tx: Executor = db) {
    const [{ total }] = await tx
      .select({ total: count() })
      .from(expedionQuotes)
      .where(sql`${expedionQuotes.airtableRecordId} is not null`);
    return Number(total);
  },
};
