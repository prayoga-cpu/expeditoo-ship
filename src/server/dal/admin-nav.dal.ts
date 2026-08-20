import { sql } from "drizzle-orm";
import { db } from "@/db";

import { QUEUE_WHERE } from "./expedion-report.dal";

/**
 * The counts behind the admin sidebar badges.
 *
 * One statement, not one per section. The sidebar is on every admin page and
 * refetches on a timer, so a dozen round trips here would be a dozen on every
 * page the operator opens — and the report already learned what a fan of
 * concurrent aggregates does to a pooled connection (see the note on
 * `expedion-report.service.ts`). Scalar subqueries also fix one `now()` across
 * the lot, so two badges cannot straddle a deadline differently.
 *
 * Nothing here is user-scoped except `support`, which counts what *this* admin
 * has not read. That is the only badge that means something different to two
 * people looking at the same screen.
 */

export interface AdminNavCounts {
  /** Quotes to price, needing a driver, or past their escalation deadline. */
  expedion: number;
  /** Accounts created in the last seven days. */
  users: number;
  /** Escalated jobs with at least one live bid and no winner picked. */
  awards: number;
  /** Listings open for bids. */
  listings: number;
  /** Carrier applications submitted or under review. */
  applications: number;
  /** Approved carriers whose paperwork lapses within thirty days. */
  drivers: number;
  /** Shipments neither delivered nor cancelled. */
  shipments: number;
  /** Payouts still waiting to be sent, plus payments that failed. */
  payments: number;
  /** Support conversations with something this admin has not read. */
  support: number;
}

/**
 * `expires_at` inside thirty days is the same cliff
 * `carrierService.processDocumentExpiry` acts on, so the badge counts exactly
 * the carriers that cron is about to warn or suspend.
 */
const DOCUMENT_HORIZON = sql`interval '30 days'`;

export async function getAdminNavCounts(
  viewerId: string
): Promise<AdminNavCounts> {
  const rows = await db.execute<Record<string, string | number | null>>(sql`
    select
      (select count(*)::int from expedion_quotes
        where ${QUEUE_WHERE.toPrice})                     as quotes_to_price,
      (select count(*)::int from expedion_quotes
        where ${QUEUE_WHERE.needsDriver})                 as quotes_needs_driver,
      (select count(*)::int from expedion_quotes
        where ${QUEUE_WHERE.escalationDue})               as quotes_escalation_due,

      (select count(*)::int from "user"
        where created_at >= now() - interval '7 days')    as new_users,

      -- An escalated job nobody has bid on is not a decision waiting to be
      -- made, so the badge counts jobs with a live offer rather than jobs.
      (select count(*)::int from listings l
        where l.status = 'open'
          and l.origin = 'expedion'
          and exists (select 1 from offers o
                       where o.listing_id = l.id
                         and o.status = 'pending'))       as awards_pending,
      (select count(*)::int from listings
        where status = 'open')                            as open_listings,

      (select count(*)::int from carriers
        where status in ('submitted','under_review'))     as applications_pending,
      (select count(distinct c.id)::int
         from carriers c
         join carrier_documents d on d.carrier_id = c.id
        where c.status = 'approved'
          and d.expires_at is not null
          and d.expires_at <= now() + ${DOCUMENT_HORIZON}) as drivers_attention,

      (select count(*)::int from shipments
        where status not in ('DELIVERED','CANCELLED'))    as active_shipments,

      (select count(*)::int from payouts
        where status = 'scheduled')                       as payouts_scheduled,
      (select count(*)::int from payments
        where status = 'failed')                          as payments_failed,

      -- Unread means "a message this admin has not seen", which is why a
      -- conversation they never joined counts in full: no participant row
      -- means no last_read_at, and they have read none of it.
      (select count(*)::int from conversations c
        where c.type = 'SUPPORT'
          and exists (
            select 1
              from messages m
              left join conversation_participants p
                on p.conversation_id = c.id and p.user_id = ${viewerId}
             where m.conversation_id = c.id
               and m.sender_id <> ${viewerId}
               and (p.last_read_at is null or m.created_at > p.last_read_at)
          ))                                              as support_unread
  `);

  const r = rows[0] ?? {};
  const n = (key: string) => Number(r[key] ?? 0);

  return {
    expedion:
      n("quotes_to_price") +
      n("quotes_needs_driver") +
      n("quotes_escalation_due"),
    users: n("new_users"),
    awards: n("awards_pending"),
    listings: n("open_listings"),
    applications: n("applications_pending"),
    drivers: n("drivers_attention"),
    shipments: n("active_shipments"),
    payments: n("payouts_scheduled") + n("payments_failed"),
    support: n("support_unread"),
  };
}
