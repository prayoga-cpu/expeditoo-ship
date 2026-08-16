import { sql } from "drizzle-orm";
import { db } from "@/db";

/**
 * Aggregates behind the operator report.
 *
 * Deliberately not scoped to a user — this is the whole-platform view, and the
 * route above it is admin-gated. That is the opposite of
 * `expedion.dal.ts#list`, which is always owner-scoped; keeping the two in
 * separate files makes it hard to reach for the wrong one.
 *
 * Each group is one round trip using `count(*) filter (...)`, so the numbers on
 * a card cannot disagree with each other. Separate queries per tile is exactly
 * how the client-side counters drifted.
 */

/** Rows whose owner id is a synthetic Airtable key rather than a real account. */
const UNOWNED = sql`firebase_uid like 'airtable:%'`;

/** Statuses a quote can sit in while still needing operator attention. */
const LIVE = sql`status not in ('delivered', 'cancelled')`;

export interface ExpedionTotals {
  total: number;
  unowned: number;
  awaitingPricing: number;
  awaitingPayment: number;
  needsDriver: number;
  escalated: number;
  assigned: number;
  delivered: number;
  cancelled: number;
  storageAtRisk: number;
  escalationDue: number;
  acceptedValueCents: number;
  paidValueCents: number;
  insuredShare: number;
}

/**
 * The headline counts.
 *
 * `storageAtRisk` uses four days to match `DSStorageCountdown.warningThresholdDays`
 * in the Flutter client — the operator should see the same cliff the buyer is
 * being warned about, not a different one.
 */
export async function getExpedionTotals(): Promise<ExpedionTotals> {
  const rows = await db.execute<Record<string, string | number>>(sql`
    select
      count(*)::int                                               as total,
      count(*) filter (where ${UNOWNED})::int                     as unowned,
      count(*) filter (where quote_available = false
                         and status in ('pending','awaiting_confirmation'))::int
                                                                  as awaiting_pricing,
      count(*) filter (where status = 'accepted'
                         and payment_status <> 'paid')::int       as awaiting_payment,
      count(*) filter (where payment_status = 'paid'
                         and assigned_carrier_id is null
                         and listing_id is null
                         and ${LIVE})::int                        as needs_driver,
      count(*) filter (where listing_id is not null
                          or status = 'escalated')::int           as escalated,
      count(*) filter (where assigned_carrier_id is not null)::int as assigned,
      count(*) filter (where status = 'delivered')::int           as delivered,
      count(*) filter (where status = 'cancelled')::int           as cancelled,
      count(*) filter (where storage_free_until is not null
                         and storage_free_until <= now() + interval '4 days'
                         and ${LIVE})::int                        as storage_at_risk,
      count(*) filter (where escalate_after is not null
                         and escalate_after <= now()
                         and assigned_carrier_id is null
                         and listing_id is null
                         and ${LIVE})::int                        as escalation_due,
      coalesce(sum(accepted_price_cents), 0)::bigint              as accepted_value,
      coalesce(sum(accepted_price_cents)
               filter (where payment_status = 'paid'), 0)::bigint as paid_value,
      count(*) filter (where accepted_kind = 'with_ad_valorem_insurance')::int
                                                                  as insured_count,
      count(*) filter (where accepted_kind is not null)::int      as accepted_count
    from expedion_quotes
  `);

  const r = rows[0] ?? {};
  const n = (k: string) => Number(r[k] ?? 0);
  const acceptedCount = n("accepted_count");

  return {
    total: n("total"),
    unowned: n("unowned"),
    awaitingPricing: n("awaiting_pricing"),
    awaitingPayment: n("awaiting_payment"),
    needsDriver: n("needs_driver"),
    escalated: n("escalated"),
    assigned: n("assigned"),
    delivered: n("delivered"),
    cancelled: n("cancelled"),
    storageAtRisk: n("storage_at_risk"),
    escalationDue: n("escalation_due"),
    acceptedValueCents: n("accepted_value"),
    paidValueCents: n("paid_value"),
    // Share of accepted quotes that took ad valorem cover. Zero accepted
    // quotes is 0, not NaN.
    insuredShare: acceptedCount === 0 ? 0 : n("insured_count") / acceptedCount,
  };
}

export interface StatusCount {
  status: string;
  count: number;
}

/** Counts per `expedion_quote_status`, for the funnel. */
export async function getStatusBreakdown(): Promise<StatusCount[]> {
  const rows = await db.execute<{ status: string; count: number }>(sql`
    select status::text as status, count(*)::int as count
    from expedion_quotes
    group by status
  `);
  return [...rows].map((r) => ({ status: r.status, count: Number(r.count) }));
}

export interface QuoteRow {
  id: string;
  reference: string | null;
  status: string;
  paymentStatus: string;
  auctionHouseName: string | null;
  deliveryCity: string | null;
  clientName: string | null;
  priceCents: number | null;
  standardCents: number | null;
  insuredCents: number | null;
  owned: boolean;
  hasPickupCoords: boolean;
  storageFreeUntil: Date | null;
  escalateAfter: Date | null;
  requestedAt: Date | null;
}

/** The projection every queue and the recent list share. */
const QUOTE_COLUMNS = sql`
  id,
  coalesce(quote_number, bordereau_number)              as reference,
  status::text                                          as status,
  payment_status::text                                  as payment_status,
  auction_house_name,
  delivery_city,
  nullif(trim(coalesce(first_name,'') || ' ' || coalesce(last_name,'')), '')
                                                        as client_name,
  coalesce(accepted_price_cents, quote_standard_cents)  as price_cents,
  quote_standard_cents                                  as standard_cents,
  quote_insured_cents                                   as insured_cents,
  not (${UNOWNED})                                      as owned,
  (pickup_lat is not null and pickup_lng is not null)   as has_pickup_coords,
  storage_free_until,
  escalate_after,
  requested_at
`;

function toQuoteRow(r: Record<string, unknown>): QuoteRow {
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  const date = (v: unknown) => (v ? new Date(v as string) : null);
  return {
    id: String(r.id),
    reference: (r.reference as string) ?? null,
    status: String(r.status),
    paymentStatus: String(r.payment_status),
    auctionHouseName: (r.auction_house_name as string) ?? null,
    deliveryCity: (r.delivery_city as string) ?? null,
    clientName: (r.client_name as string) ?? null,
    priceCents: num(r.price_cents),
    standardCents: num(r.standard_cents),
    insuredCents: num(r.insured_cents),
    owned: r.owned === true,
    hasPickupCoords: r.has_pickup_coords === true,
    storageFreeUntil: date(r.storage_free_until),
    escalateAfter: date(r.escalate_after),
    requestedAt: date(r.requested_at),
  };
}

/** Which operator queue to fetch. */
export type QueueKind =
  | "toPrice"
  | "needsDriver"
  | "storageAtRisk"
  | "escalationDue";

const QUEUE_WHERE: Record<QueueKind, ReturnType<typeof sql>> = {
  toPrice: sql`quote_available = false and status in ('pending','awaiting_confirmation')`,
  needsDriver: sql`payment_status = 'paid' and assigned_carrier_id is null
                   and listing_id is null and ${LIVE}`,
  storageAtRisk: sql`storage_free_until is not null
                     and storage_free_until <= now() + interval '4 days'
                     and ${LIVE}`,
  escalationDue: sql`escalate_after is not null and escalate_after <= now()
                     and assigned_carrier_id is null and listing_id is null
                     and ${LIVE}`,
};

/**
 * One operator queue, oldest first — the work that has been waiting longest is
 * the work to do next, which is the opposite of the newest-first the recent
 * list wants.
 */
export async function getQueue(kind: QueueKind, limit = 50): Promise<QuoteRow[]> {
  const rows = await db.execute<Record<string, unknown>>(sql`
    select ${QUOTE_COLUMNS}
    from expedion_quotes
    where ${QUEUE_WHERE[kind]}
    order by requested_at asc nulls last
    limit ${limit}
  `);
  return [...rows].map(toQuoteRow);
}

export async function getRecentQuotes(limit = 25): Promise<QuoteRow[]> {
  const rows = await db.execute<Record<string, unknown>>(sql`
    select ${QUOTE_COLUMNS}
    from expedion_quotes
    order by requested_at desc nulls last
    limit ${limit}
  `);
  return [...rows].map(toQuoteRow);
}

export interface MarketplaceTotals {
  expedionListings: number;
  directListings: number;
  offersOnExpedionJobs: number;
  expedionShipments: number;
  deliveredShipments: number;
  carriersApproved: number;
  carriersPending: number;
  activeVehicles: number;
}

/**
 * The Expeditoo half of the report.
 *
 * `origin = 'expedion'` on `listings` is what distinguishes an escalated
 * auction job from a directly-posted one, so it is the join that makes a
 * cross-product number meaningful rather than two unrelated totals.
 */
export async function getMarketplaceTotals(): Promise<MarketplaceTotals> {
  const [listings] = await db.execute<Record<string, string | number>>(sql`
    select
      count(*) filter (where origin = 'expedion')::int as expedion_listings,
      count(*) filter (where origin = 'direct')::int   as direct_listings
    from listings
  `);

  const [offers] = await db.execute<Record<string, string | number>>(sql`
    select count(*)::int as offers
    from offers o
    join listings l on l.id = o.listing_id
    where l.origin = 'expedion'
  `);

  const [shipments] = await db.execute<Record<string, string | number>>(sql`
    select
      count(*) filter (where l.origin = 'expedion')::int as expedion_shipments,
      count(*) filter (where s.status = 'DELIVERED')::int as delivered
    from shipments s
    join listings l on l.id = s.listing_id
  `);

  const [carriers] = await db.execute<Record<string, string | number>>(sql`
    select
      count(*) filter (where status = 'approved')::int as approved,
      count(*) filter (where status in ('submitted','under_review'))::int as pending
    from carriers
  `);

  const [vehicles] = await db.execute<Record<string, string | number>>(sql`
    select count(*) filter (where is_active)::int as active from vehicles
  `);

  const n = (row: Record<string, string | number> | undefined, k: string) =>
    Number(row?.[k] ?? 0);

  return {
    expedionListings: n(listings, "expedion_listings"),
    directListings: n(listings, "direct_listings"),
    offersOnExpedionJobs: n(offers, "offers"),
    expedionShipments: n(shipments, "expedion_shipments"),
    deliveredShipments: n(shipments, "delivered"),
    carriersApproved: n(carriers, "approved"),
    carriersPending: n(carriers, "pending"),
    activeVehicles: n(vehicles, "active"),
  };
}

export interface DataHealth {
  unowned: number;
  missingPickupCoords: number;
  missingDimensions: number;
  meanExtractionConfidence: number | null;
  extracted: number;
}

/**
 * How trustworthy the data underneath the rest of the page is.
 *
 * `missingPickupCoords` matters operationally, not just cosmetically: without
 * them `escalationBlockers` refuses to escalate, so those rows can never reach
 * a carrier however long the timer runs.
 */
export async function getDataHealth(): Promise<DataHealth> {
  const [row] = await db.execute<Record<string, string | number | null>>(sql`
    select
      count(*) filter (where ${UNOWNED})::int                       as unowned,
      count(*) filter (where (pickup_lat is null or pickup_lng is null)
                         and ${LIVE})::int                          as missing_coords,
      count(*) filter (where (length_cm is null or width_cm is null
                              or height_cm is null or weight_kg is null)
                         and ${LIVE})::int                          as missing_dims,
      avg(extraction_confidence)                                    as mean_confidence,
      count(*) filter (where extraction_confidence is not null)::int as extracted
    from expedion_quotes
  `);

  const mean = row?.mean_confidence;
  return {
    unowned: Number(row?.unowned ?? 0),
    missingPickupCoords: Number(row?.missing_coords ?? 0),
    missingDimensions: Number(row?.missing_dims ?? 0),
    meanExtractionConfidence: mean === null || mean === undefined ? null : Number(mean),
    extracted: Number(row?.extracted ?? 0),
  };
}

export interface MonthPoint {
  name: string;
  quotes: number;
  acceptedCents: number;
}

/**
 * Six months of quote volume and accepted value, in one query.
 *
 * One `group by` rather than the six sequential round trips
 * `admin.service#getDashboardStats` makes for its revenue series — the shape
 * there is already the slowest part of that page and is not worth copying.
 */
export async function getMonthlySeries(months = 6): Promise<MonthPoint[]> {
  const rows = await db.execute<Record<string, string | number>>(sql`
    select
      to_char(date_trunc('month', requested_at), 'YYYY-MM')   as bucket,
      count(*)::int                                           as quotes,
      coalesce(sum(accepted_price_cents), 0)::bigint          as accepted
    from expedion_quotes
    where requested_at >= date_trunc('month', now()) - (${months - 1} || ' months')::interval
    group by 1
    order by 1
  `);

  return [...rows].map((r) => ({
    name: String(r.bucket),
    quotes: Number(r.quotes),
    acceptedCents: Number(r.accepted),
  }));
}
