import { and, asc, countDistinct, desc, eq, isNotNull, isNull, or, sql } from "drizzle-orm";
import type { AnyColumn, SQL } from "drizzle-orm";

import { db } from "@/db";
import { expedionQuotes } from "@/db/schema/expedion";
import { user } from "@/db/schema/users";

type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export type ClientSort = "lastSeen" | "quotes" | "value" | "name";
export type ClientLinkFilter = "all" | "withAccount" | "withoutAccount";

export interface ExpedionClientFilters {
  search?: string;
  linked: ClientLinkFilter;
  sortBy: ClientSort;
  sortOrder: "asc" | "desc";
  page: number;
  pageSize: number;
}

export interface ExpedionClientRow {
  ownerId: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  quoteCount: number;
  paidCount: number;
  deliveredCount: number;
  paidValueCents: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  accountUserId: string | null;
  accountName: string | null;
  accountEmail: string | null;
  accountBanned: boolean | null;
}

/**
 * The most recent non-null value of a column across an owner's quotes.
 *
 * Not `max()`: on a text column that returns the alphabetically largest value,
 * so a client who corrected their surname keeps whichever spelling sorts
 * later. What an admin wants is what the client last told us. The `filter`
 * clause is what makes it *non-null* rather than merely newest — a client
 * whose latest quote omitted their phone still shows the number they gave
 * before.
 */
function mostRecent(column: AnyColumn) {
  return sql<
    string | null
  >`(array_agg(${column} order by ${expedionQuotes.createdAt} desc) filter (where ${column} is not null))[1]`;
}

const PAID = sql`${expedionQuotes.paymentStatus} = 'paid'`;

/**
 * The aggregate columns, shared by the list and the single-owner read so the
 * dialog can never report a different total from the row that opened it.
 */
const CLIENT_COLUMNS = {
  ownerId: expedionQuotes.firebaseUid,
  firstName: mostRecent(expedionQuotes.firstName),
  lastName: mostRecent(expedionQuotes.lastName),
  email: mostRecent(expedionQuotes.email),
  phone: mostRecent(expedionQuotes.phone),
  city: mostRecent(expedionQuotes.clientCity),
  quoteCount: sql<number>`count(*)::int`,
  paidCount: sql<number>`count(*) filter (where ${PAID})::int`,
  deliveredCount: sql<number>`count(*) filter (where ${expedionQuotes.status} = 'delivered')::int`,
  paidValueCents: sql<number>`coalesce(sum(${expedionQuotes.acceptedPriceCents}) filter (where ${PAID}), 0)::int`,
  firstSeenAt: sql<Date>`min(${expedionQuotes.createdAt})`,
  lastSeenAt: sql<Date>`max(${expedionQuotes.createdAt})`,
  accountUserId: user.id,
  accountName: user.name,
  accountEmail: user.email,
  accountBanned: user.banned,
};

export const expedionClientsDal = {
  /**
   * Expedion's client book, one row per owner.
   *
   * Grouped by `firebase_uid` because that is the key the rest of the system
   * owns a client by — `expedionDal.list` scopes "my quotes" against this
   * exact column. Its name predates Better Auth and now means *owner*; see
   * `ExpedionCaller.userId` in src/lib/expedion-auth.ts.
   *
   * `user` is joined on `user.id = firebase_uid`, which is proof the owner has
   * an account here: the Better Auth path in expedion-auth.ts writes the
   * Better Auth user id into that column. `expedion_quotes.user_id` is
   * deliberately not joined — see
   * docs/specs/admin_expedion_clients_spec.md §2.1. Grouping by `user.id`
   * is what lets the other `user` columns be selected: postgres allows
   * ungrouped columns of a table whose primary key is in the GROUP BY.
   */
  async list(filters: ExpedionClientFilters, tx: Executor = db) {
    const order = ORDER[filters.sortBy];

    const rows = await tx
      .select(CLIENT_COLUMNS)
      .from(expedionQuotes)
      .leftJoin(user, eq(user.id, expedionQuotes.firebaseUid))
      .where(buildWhere(filters))
      .groupBy(expedionQuotes.firebaseUid, user.id)
      .orderBy(filters.sortOrder === "asc" ? asc(order) : desc(order))
      .limit(filters.pageSize)
      .offset((filters.page - 1) * filters.pageSize);

    return rows as ExpedionClientRow[];
  },

  /**
   * How many owners the filter matches.
   *
   * `countDistinct` on the owner key, not `count(*)`: the page lists clients,
   * and counting quote rows would report a client with forty quotes as forty
   * clients and paginate against a total no page can reach.
   */
  async count(filters: ExpedionClientFilters, tx: Executor = db) {
    const [row] = await tx
      .select({ total: countDistinct(expedionQuotes.firebaseUid) })
      .from(expedionQuotes)
      .leftJoin(user, eq(user.id, expedionQuotes.firebaseUid))
      .where(buildWhere(filters));

    return Number(row?.total ?? 0);
  },

  /** One owner's aggregate, or null when the key matches no quote. */
  async getOne(ownerId: string, tx: Executor = db) {
    const [row] = await tx
      .select(CLIENT_COLUMNS)
      .from(expedionQuotes)
      .leftJoin(user, eq(user.id, expedionQuotes.firebaseUid))
      .where(eq(expedionQuotes.firebaseUid, ownerId))
      .groupBy(expedionQuotes.firebaseUid, user.id);

    return (row as ExpedionClientRow | undefined) ?? null;
  },

  /**
   * That owner's quotes, newest first.
   *
   * Capped rather than paginated: the dialog answers "what has this client
   * asked for", and an owner with more than a hundred quotes is a question for
   * /admin/expedion, not a scrolling problem for this screen.
   */
  async quotesFor(ownerId: string, limit = 100, tx: Executor = db) {
    return await tx
      .select({
        id: expedionQuotes.id,
        quoteNumber: expedionQuotes.quoteNumber,
        bordereauNumber: expedionQuotes.bordereauNumber,
        status: expedionQuotes.status,
        paymentStatus: expedionQuotes.paymentStatus,
        acceptedPriceCents: expedionQuotes.acceptedPriceCents,
        pickupCity: expedionQuotes.pickupCity,
        deliveryCity: expedionQuotes.deliveryCity,
        listingId: expedionQuotes.listingId,
        createdAt: expedionQuotes.createdAt,
      })
      .from(expedionQuotes)
      .where(eq(expedionQuotes.firebaseUid, ownerId))
      .orderBy(desc(expedionQuotes.createdAt))
      .limit(limit);
  },
};

const ORDER: Record<ClientSort, SQL> = {
  lastSeen: sql`max(${expedionQuotes.createdAt})`,
  quotes: sql`count(*)`,
  value: sql`coalesce(sum(${expedionQuotes.acceptedPriceCents}) filter (where ${PAID}), 0)`,
  // Sorted on what the column actually displays, and on one stable value
  // rather than the array_agg expression, which postgres will not accept in
  // ORDER BY beside the aggregate it is built from.
  name: sql`lower(coalesce(min(${expedionQuotes.lastName}), min(${expedionQuotes.email}), ''))`,
};

/**
 * Applied *before* aggregation, so an owner matches when any one of their
 * quotes does. That is what makes searching a bordereau number find the client
 * who filed it, which is the question an admin actually asks.
 */
function buildWhere(filters: ExpedionClientFilters) {
  const term = filters.search?.trim();
  const like = term ? `%${term}%` : undefined;

  return and(
    ...[
      like
        ? or(
            sql`${expedionQuotes.firstName} ilike ${like}`,
            sql`${expedionQuotes.lastName} ilike ${like}`,
            sql`${expedionQuotes.email} ilike ${like}`,
            sql`${expedionQuotes.phone} ilike ${like}`,
            sql`${expedionQuotes.clientCity} ilike ${like}`,
            sql`${expedionQuotes.bordereauNumber} ilike ${like}`,
            sql`${expedionQuotes.firebaseUid} ilike ${like}`
          )
        : undefined,
      // Filtered on the join result rather than a subquery: `user.id is null`
      // after a left join is exactly "no account matched this owner key".
      filters.linked === "withAccount" ? isNotNull(user.id) : undefined,
      filters.linked === "withoutAccount" ? isNull(user.id) : undefined,
    ].filter(Boolean)
  );
}
