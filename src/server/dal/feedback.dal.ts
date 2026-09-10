import { db } from "@/db";
import {
  feedbackTickets,
  type FeedbackTicket,
  type FeedbackStatusValue,
  type InsertFeedbackTicket,
} from "@/db/schema/feedback";
import { user } from "@/db/schema/users";
import { and, asc, count, desc, eq, gte, ilike, or, sql } from "drizzle-orm";
import type { FeedbackQuery } from "@/server/dto/feedback.dto";

type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Permission-blind, like every DAL here (docs/rules.md §1.4). Whether a caller
 * may see a ticket is `feedbackService`'s question; this module only knows how
 * to read and write rows.
 */

/** A ticket plus the reporter's live account, when it still exists. */
export interface QueuedFeedback {
  ticket: FeedbackTicket;
  account: { id: string; name: string; email: string } | null;
}

export async function create(
  data: InsertFeedbackTicket,
  tx: Executor = db
): Promise<FeedbackTicket> {
  const [row] = await tx.insert(feedbackTickets).values(data).returning();
  return row;
}

export async function getById(
  id: string,
  tx: Executor = db
): Promise<FeedbackTicket | undefined> {
  const [row] = await tx
    .select()
    .from(feedbackTickets)
    .where(eq(feedbackTickets.id, id))
    .limit(1);
  return row;
}

export async function listForUser(
  userId: string,
  limit = 50,
  tx: Executor = db
): Promise<FeedbackTicket[]> {
  return tx
    .select()
    .from(feedbackTickets)
    .where(eq(feedbackTickets.userId, userId))
    .orderBy(desc(feedbackTickets.createdAt))
    .limit(limit);
}

/** Feeds the abuse brake — how many this account filed since a given instant. */
export async function countRecentByUser(
  userId: string,
  since: Date,
  tx: Executor = db
): Promise<number> {
  const [row] = await tx
    .select({ n: count() })
    .from(feedbackTickets)
    .where(
      and(
        eq(feedbackTickets.userId, userId),
        gte(feedbackTickets.createdAt, since)
      )
    );
  return row?.n ?? 0;
}

/**
 * The filter clause, built once and shared by the page query and the counts.
 *
 * `withStatus` is the whole reason this is a function: the tile counts use the
 * same filter MINUS the status clause, because including it makes the other
 * four tiles read zero the moment one is clicked.
 */
function whereFor(filters: FeedbackQuery, withStatus: boolean) {
  const clauses = [];
  if (withStatus && filters.status)
    clauses.push(eq(feedbackTickets.status, filters.status));
  if (filters.type) clauses.push(eq(feedbackTickets.type, filters.type));
  if (filters.priority)
    clauses.push(eq(feedbackTickets.priority, filters.priority));
  if (filters.search) {
    const q = `%${filters.search}%`;
    clauses.push(
      or(
        ilike(feedbackTickets.description, q),
        ilike(feedbackTickets.userName, q),
        ilike(feedbackTickets.userEmail, q),
        // An exact id, so an operator can paste a #REF straight in.
        eq(feedbackTickets.id, filters.search)
      )
    );
  }
  return clauses.length ? and(...clauses) : undefined;
}

/**
 * One page of the console.
 *
 * Ordered by the two enums' declaration order, which is triage order — so no
 * `CASE` expression and no sorting in the browser. The sibling product fetches
 * a hard `take: 500` with no paging and filters client-side, which means the
 * 501st ticket simply never appears and nothing says so.
 */
export async function listQueue(
  filters: FeedbackQuery,
  tx: Executor = db
): Promise<{ items: QueuedFeedback[]; total: number }> {
  const where = whereFor(filters, true);

  const rows = await tx
    .select({
      ticket: feedbackTickets,
      accountId: user.id,
      accountName: user.name,
      accountEmail: user.email,
    })
    .from(feedbackTickets)
    .leftJoin(user, eq(user.id, feedbackTickets.userId))
    .where(where)
    .orderBy(
      asc(feedbackTickets.status),
      asc(feedbackTickets.priority),
      desc(feedbackTickets.createdAt)
    )
    .limit(filters.limit)
    .offset(filters.offset);

  const [totalRow] = await tx
    .select({ n: count() })
    .from(feedbackTickets)
    .where(where);

  return {
    items: rows.map((r) => ({
      ticket: r.ticket,
      account:
        r.accountId && r.accountName !== null && r.accountEmail !== null
          ? { id: r.accountId, name: r.accountName, email: r.accountEmail }
          : null,
    })),
    total: totalRow?.n ?? 0,
  };
}

/** The five tile counts, under every filter EXCEPT status. */
export async function countsByStatus(
  filters: FeedbackQuery,
  tx: Executor = db
): Promise<Partial<Record<FeedbackStatusValue, number>>> {
  const rows = await tx
    .select({
      status: feedbackTickets.status,
      n: sql<number>`count(*)::int`,
    })
    .from(feedbackTickets)
    .where(whereFor(filters, false))
    .groupBy(feedbackTickets.status);

  return Object.fromEntries(rows.map((r) => [r.status, r.n])) as Partial<
    Record<FeedbackStatusValue, number>
  >;
}

export async function update(
  id: string,
  patch: Partial<InsertFeedbackTicket>,
  tx: Executor = db
): Promise<FeedbackTicket | undefined> {
  const [row] = await tx
    .update(feedbackTickets)
    .set(patch)
    .where(eq(feedbackTickets.id, id))
    .returning();
  return row;
}
