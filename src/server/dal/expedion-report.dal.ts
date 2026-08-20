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

/**
 * The rows escalation will actually take, ignoring the data it needs (see
 * `ESCALATION_READY`).
 *
 * `status = 'paid'` and `escalated_at is null` are not decoration. The cron
 * filters on both (`expedionDal.findDueForEscalation`), and the Escalate
 * button fails the transition check on the first and the claim on the second
 * (`expedionEscalationService.escalate`), so a queue without them lists work
 * that both paths then refuse — a stuck half-escalation, claimed but with no
 * listing behind it, is the row that used to sit there forever.
 */
const ESCALATION_DUE = sql`escalate_after is not null
  and escalate_after <= now()
  and status = 'paid'
  and assigned_carrier_id is null
  and escalated_at is null
  and listing_id is null`;

/**
 * Whether a row carries everything a marketplace listing needs — the SQL
 * mirror of `escalationBlockers`, which is the authority but wants a hydrated
 * quote and so cannot be asked about a whole queue at once. Keep the two in
 * step.
 *
 * Deliberately a label rather than part of `ESCALATION_DUE`: a job the timer
 * has given up on for want of a postal code is exactly what the operator has
 * to see, so it stays in the queue wearing a badge instead of vanishing.
 */
const ESCALATION_READY = sql`
  pickup_lat is not null and pickup_lng is not null
  and delivery_lat is not null and delivery_lng is not null
  and coalesce(pickup_address, '') <> ''
  and coalesce(pickup_city, '') <> ''
  and coalesce(delivery_address, '') <> ''
  and coalesce(delivery_city, '') <> ''
  and regexp_replace(coalesce(pickup_postal_code, ''), '[^0-9]', '', 'g')
      ~ '^[0-9]{5}$'
  and regexp_replace(coalesce(delivery_postal_code, ''), '[^0-9]', '', 'g')
      ~ '^[0-9]{5}$'
  and coalesce(weight_kg, 0) > 0
  and coalesce(accepted_price_cents, 0) >= 100`;

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
 *
 * `escalated` and `assigned` partition the jobs that reached a driver rather
 * than overlapping: a carrier winning an escalated listing writes its id back
 * onto the quote (`expedion-bridge.service#writeBack`), so counting every row
 * with a carrier as `assigned` counted each successful escalation twice and
 * pushed the escalation rate below the truth. `assigned` is therefore the
 * internal pool only, and the two sum to the jobs that found a driver or went
 * looking for one.
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
      count(*) filter (where assigned_carrier_id is not null
                         and listing_id is null
                         and status <> 'escalated')::int          as assigned,
      count(*) filter (where status = 'delivered')::int           as delivered,
      count(*) filter (where status = 'cancelled')::int           as cancelled,
      count(*) filter (where storage_free_until is not null
                         and storage_free_until <= now() + interval '4 days'
                         and ${LIVE})::int                        as storage_at_risk,
      count(*) filter (where ${ESCALATION_DUE})::int              as escalation_due,
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

/** Which operator queue to fetch. */
export type QueueKind =
  | "toPrice"
  | "needsDriver"
  | "storageAtRisk"
  | "escalationDue";

/**
 * The four queue predicates, exported because the sidebar badge counts the
 * same work this page lists (`admin-nav.dal.ts`). A second copy of "needs a
 * driver" over there would drift from this one the first time either moved,
 * and the badge disagreeing with the queue it points at is worse than no badge.
 */
export const QUEUE_WHERE: Record<QueueKind, ReturnType<typeof sql>> = {
  toPrice: sql`quote_available = false and status in ('pending','awaiting_confirmation')`,
  needsDriver: sql`payment_status = 'paid' and assigned_carrier_id is null
                   and listing_id is null and ${LIVE}`,
  storageAtRisk: sql`storage_free_until is not null
                     and storage_free_until <= now() + interval '4 days'
                     and ${LIVE}`,
  escalationDue: ESCALATION_DUE,
};

export interface QuoteRow {
  id: string;
  reference: string | null;
  status: string;
  paymentStatus: string;
  auctionHouseName: string | null;
  deliveryCity: string | null;
  clientName: string | null;
  /**
   * The address the client gave on the bordereau. Often the only identity an
   * Airtable-imported row has — those carry no account and frequently no name
   * either, and "—" in every column is not something an operator can chase.
   */
  clientEmail: string | null;
  priceCents: number | null;
  standardCents: number | null;
  insuredCents: number | null;
  owned: boolean;
  hasPickupCoords: boolean;
  /**
   * Whether `escalationBlockers` would pass this row. Broader than
   * `hasPickupCoords`, which is only one of the ten things escalation demands
   * — a row missing a delivery postal code reads as ready by that flag and
   * then 422s on click. Optional only because the callers predate it.
   */
  escalationReady?: boolean;
  /**
   * Which operator queues this row is in, straight from `QUEUE_WHERE` — the
   * same predicates that build the queues themselves, evaluated once per row.
   *
   * The recent list needs this to say what a quote is waiting for, and
   * re-deriving it on the client from `status` alone would be a second,
   * looser definition: `needsDriver` turns on a null carrier *and* a null
   * listing, neither of which is on the wire.
   */
  queues: Record<QueueKind, boolean>;
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
  email                                                 as client_email,
  coalesce(accepted_price_cents, quote_standard_cents)  as price_cents,
  quote_standard_cents                                  as standard_cents,
  quote_insured_cents                                   as insured_cents,
  not (${UNOWNED})                                      as owned,
  (pickup_lat is not null and pickup_lng is not null)   as has_pickup_coords,
  (${ESCALATION_READY})                                 as escalation_ready,
  (${QUEUE_WHERE.toPrice})                              as f_to_price,
  (${QUEUE_WHERE.needsDriver})                          as f_needs_driver,
  (${QUEUE_WHERE.storageAtRisk})                        as f_storage_at_risk,
  (${QUEUE_WHERE.escalationDue})                        as f_escalation_due,
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
    clientEmail: (r.client_email as string) ?? null,
    priceCents: num(r.price_cents),
    standardCents: num(r.standard_cents),
    insuredCents: num(r.insured_cents),
    owned: r.owned === true,
    hasPickupCoords: r.has_pickup_coords === true,
    escalationReady: r.escalation_ready === true,
    queues: {
      toPrice: r.f_to_price === true,
      needsDriver: r.f_needs_driver === true,
      storageAtRisk: r.f_storage_at_risk === true,
      escalationDue: r.f_escalation_due === true,
    },
    storageFreeUntil: date(r.storage_free_until),
    escalateAfter: date(r.escalate_after),
    requestedAt: date(r.requested_at),
  };
}

/**
 * One operator queue, oldest first — the work that has been waiting longest is
 * the work to do next, which is the opposite of the newest-first the recent
 * list wants.
 *
 * `id` breaks ties on `requested_at`, which is far from unique — about a fifth
 * as many distinct values as rows. Without it the top-`limit` cut is only as
 * stable as the plan that produced it, and the plan is not stable: escalation
 * has an index on `escalate_after`, so once that column is populated this
 * query can switch to an index scan and hand the sort a different row order,
 * and a *different set* of fifty rows comes back. That matters most on
 * `escalationDue`, the queue whose whole job is that a job the timer gave up
 * on cannot sit unseen. The same tiebreaker is on the batched form in
 * `getReportRowSets`, so the two agree by construction rather than by luck.
 */
export async function getQueue(kind: QueueKind, limit = 50): Promise<QuoteRow[]> {
  const rows = await db.execute<Record<string, unknown>>(sql`
    select ${QUOTE_COLUMNS}
    from expedion_quotes
    where ${QUEUE_WHERE[kind]}
    order by requested_at asc nulls last, id
    limit ${limit}
  `);
  return [...rows].map(toQuoteRow);
}

export async function getRecentQuotes(limit = 25): Promise<QuoteRow[]> {
  const rows = await db.execute<Record<string, unknown>>(sql`
    select ${QUOTE_COLUMNS}
    from expedion_quotes
    order by requested_at desc nulls last, id
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
  const [row] = await db.execute<Record<string, string | number>>(sql`
    with ${MARKETPLACE_CTES}
    select * from lst, ofr, shp, car, veh
  `);

  return toMarketplaceTotals(row);
}

/**
 * The five marketplace aggregates as single-row CTEs.
 *
 * They were five sequential `await`s, which cost five round trips to
 * eu-central-1 for numbers that share no data. Each CTE is a bare aggregate,
 * so it yields exactly one row even against an empty table and the cross join
 * that consumes them can only produce one row.
 *
 * Every output column is named for what it counts rather than for its CTE,
 * because `getReportScalars` cross-joins these with the quote aggregates and
 * selects `.*` from both: a bare `delivered` here would collide with the
 * quotes `delivered`, and postgres.js resolves a duplicate column name by
 * keeping the last one silently. That would have reported 0 delivered quotes
 * with no error anywhere.
 *
 * The fragment omits its own `with` so both callers can splice it into a
 * larger CTE list.
 */
const MARKETPLACE_CTES = sql`
  lst as (
    select
      count(*) filter (where origin = 'expedion')::int as expedion_listings,
      count(*) filter (where origin = 'direct')::int   as direct_listings
    from listings
  ),
  ofr as (
    select count(*)::int as offers_on_expedion
    from offers o
    join listings l on l.id = o.listing_id
    where l.origin = 'expedion'
  ),
  shp as (
    select
      count(*) filter (where l.origin = 'expedion')::int  as expedion_shipments,
      count(*) filter (where s.status = 'DELIVERED')::int as delivered_shipments
    from shipments s
    join listings l on l.id = s.listing_id
  ),
  car as (
    select
      count(*) filter (where status = 'approved')::int as carriers_approved,
      count(*) filter (where status in ('submitted','under_review'))::int
                                                      as carriers_pending
    from carriers
  ),
  veh as (
    select count(*) filter (where is_active)::int as active_vehicles from vehicles
  )
`;

/** Shared by the batched and per-section paths so the mapping cannot drift. */
function toMarketplaceTotals(
  row: Record<string, string | number> | undefined
): MarketplaceTotals {
  const n = (k: string) => Number(row?.[k] ?? 0);
  return {
    expedionListings: n("expedion_listings"),
    directListings: n("direct_listings"),
    offersOnExpedionJobs: n("offers_on_expedion"),
    expedionShipments: n("expedion_shipments"),
    deliveredShipments: n("delivered_shipments"),
    carriersApproved: n("carriers_approved"),
    carriersPending: n("carriers_pending"),
    activeVehicles: n("active_vehicles"),
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
 *
 * The months come from `generate_series` rather than from the rows, so a month
 * with no quotes is a zero and not a missing point: an area chart joins the
 * months either side of a gap and draws a quiet month as steady volume.
 */
export async function getMonthlySeries(months = 6): Promise<MonthPoint[]> {
  const rows = await db.execute<Record<string, string | number>>(sql`
    with span as (
      select generate_series(
        date_trunc('month', now()) - (${months - 1} || ' months')::interval,
        date_trunc('month', now()),
        interval '1 month'
      ) as bucket
    )
    select
      to_char(span.bucket, 'YYYY-MM')                         as bucket,
      count(q.id)::int                                        as quotes,
      coalesce(sum(q.accepted_price_cents), 0)::bigint        as accepted
    from span
    left join expedion_quotes q
      on date_trunc('month', q.requested_at) = span.bucket
    group by span.bucket
    order by span.bucket
  `);

  return [...rows].map((r) => ({
    name: String(r.bucket),
    quotes: Number(r.quotes),
    acceptedCents: Number(r.accepted),
  }));
}

/**
 * The projection's *output* names, re-selected off the shared CTE below.
 *
 * `QUOTE_COLUMNS` computes the fields; this lists them by the names it gave
 * them, so each JSON object carries exactly what `toQuoteRow` reads — the four
 * `f_*` queue flags included, since the recent list reads them to say what a
 * quote is waiting for. Only the series columns computed alongside them stay
 * on the server.
 */
const QUOTE_FIELDS = sql`
  id, reference, status, payment_status, auction_house_name, delivery_city,
  client_name, client_email, price_cents, standard_cents, insured_cents, owned,
  has_pickup_coords, escalation_ready, f_to_price, f_needs_driver,
  f_storage_at_risk, f_escalation_due, storage_free_until, escalate_after,
  requested_at`;

export interface ReportScalars {
  quotes: ExpedionTotals;
  marketplace: MarketplaceTotals;
  health: DataHealth;
}

/**
 * Every scalar the report shows, in one round trip.
 *
 * `getExpedionTotals` and `getDataHealth` are one scan rather than two — they
 * count the same table and share the `unowned` column outright — and the
 * marketplace aggregates ride along as the single-row CTEs above.
 *
 * The platform figures are deliberately *not* here. They belong to `admin.dal`,
 * which defines what an active driver and an app fee are for the whole admin
 * area; restating them in this file to save one concurrent query is exactly the
 * second definition that would drift from the one every other page shows.
 */
export async function getReportScalars(): Promise<ReportScalars> {
  const rows = await db.execute<Record<string, string | number | null>>(sql`
    with q as (
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
        count(*) filter (where assigned_carrier_id is not null
                           and listing_id is null
                           and status <> 'escalated')::int          as assigned,
        count(*) filter (where status = 'delivered')::int           as delivered,
        count(*) filter (where status = 'cancelled')::int           as cancelled,
        count(*) filter (where storage_free_until is not null
                           and storage_free_until <= now() + interval '4 days'
                           and ${LIVE})::int                        as storage_at_risk,
        count(*) filter (where ${ESCALATION_DUE})::int              as escalation_due,
        coalesce(sum(accepted_price_cents), 0)::bigint              as accepted_value,
        coalesce(sum(accepted_price_cents)
                 filter (where payment_status = 'paid'), 0)::bigint as paid_value,
        count(*) filter (where accepted_kind = 'with_ad_valorem_insurance')::int
                                                                    as insured_count,
        count(*) filter (where accepted_kind is not null)::int      as accepted_count,
        count(*) filter (where (pickup_lat is null or pickup_lng is null)
                           and ${LIVE})::int                        as missing_coords,
        count(*) filter (where (length_cm is null or width_cm is null
                                or height_cm is null or weight_kg is null)
                           and ${LIVE})::int                        as missing_dims,
        avg(extraction_confidence)                                  as mean_confidence,
        count(*) filter (where extraction_confidence is not null)::int as extracted
      from expedion_quotes
    ),
    ${MARKETPLACE_CTES}
    select q.*, lst.*, ofr.*, shp.*, car.*, veh.*
    from q, lst, ofr, shp, car, veh
  `);

  const r = rows[0] ?? {};
  const n = (k: string) => Number(r[k] ?? 0);
  const acceptedCount = n("accepted_count");
  const mean = r.mean_confidence;

  return {
    quotes: {
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
      insuredShare:
        acceptedCount === 0 ? 0 : n("insured_count") / acceptedCount,
    },
    marketplace: toMarketplaceTotals(
      r as unknown as Record<string, string | number>
    ),
    health: {
      unowned: n("unowned"),
      missingPickupCoords: n("missing_coords"),
      missingDimensions: n("missing_dims"),
      meanExtractionConfidence:
        mean === null || mean === undefined ? null : Number(mean),
      extracted: n("extracted"),
    },
  };
}

export interface ReportRowSets {
  statuses: StatusCount[];
  series: MonthPoint[];
  queues: Record<QueueKind, QuoteRow[]>;
  recent: QuoteRow[];
}

/**
 * Every row set the report shows, in one round trip.
 *
 * The quote projection is scanned once and each set is aggregated off it, so
 * the six lists cost one pass rather than six. `as materialized` is spelled out
 * because the CTE is referenced seven times: it makes the single scan
 * deliberate, and it fixes one `now()` for the whole report, so the storage
 * cliff the queue counts and the one it lists cannot disagree.
 *
 * `coalesce(..., '[]'::json)` is load-bearing, not defensive — `json_agg` over
 * no rows returns SQL NULL, and two of these queues are empty on real data.
 */
export async function getReportRowSets(
  months = 6,
  queueLimit = 50,
  recentLimit = 25
): Promise<ReportRowSets> {
  const queue = (flag: ReturnType<typeof sql>) => sql`
    (select coalesce(json_agg(t order by t.requested_at asc nulls last, t.id),
                     '[]'::json)
       from (select ${QUOTE_FIELDS} from q
              where ${flag}
              order by q.requested_at asc nulls last, q.id
              limit ${queueLimit}) t)`;

  const rows = await db.execute<Record<string, unknown>>(sql`
    with q as materialized (
      select
        ${QUOTE_COLUMNS},
        accepted_price_cents              as accepted_cents,
        date_trunc('month', requested_at) as month_bucket
      from expedion_quotes
    ),
    span as (
      select generate_series(
        date_trunc('month', now()) - (${months - 1} || ' months')::interval,
        date_trunc('month', now()),
        interval '1 month'
      ) as bucket
    )
    select
      (select coalesce(json_agg(s order by s.status), '[]'::json)
         from (select q.status, count(*)::int as count
                 from q group by q.status) s)              as statuses,

      (select coalesce(json_agg(json_build_object(
                  'bucket', m.label, 'quotes', m.quotes, 'accepted', m.accepted
                ) order by m.bucket), '[]'::json)
         from (select span.bucket                                as bucket,
                      to_char(span.bucket, 'YYYY-MM')            as label,
                      count(q.id)::int                           as quotes,
                      coalesce(sum(q.accepted_cents), 0)::bigint as accepted
                 from span
                 left join q on q.month_bucket = span.bucket
                group by span.bucket) m)                   as series,

      ${queue(sql`q.f_to_price`)}                          as queue_to_price,
      ${queue(sql`q.f_needs_driver`)}                      as queue_needs_driver,
      ${queue(sql`q.f_storage_at_risk`)}                   as queue_storage_at_risk,
      ${queue(sql`q.f_escalation_due`)}                    as queue_escalation_due,

      (select coalesce(json_agg(t order by t.requested_at desc nulls last, t.id),
                       '[]'::json)
         from (select ${QUOTE_FIELDS} from q
                order by q.requested_at desc nulls last, q.id
                limit ${recentLimit}) t)                   as recent
  `);

  return toReportRowSets(rows[0] ?? {});
}

/**
 * Splits one JSON row into the six sets.
 *
 * Exported for the unit tests: nothing here can be exercised against a database
 * in unit tests, but every wrong-shape case that would reach it — a null where
 * an array is expected, a bigint arriving as a string — is worth pinning.
 */
export function toReportRowSets(r: Record<string, unknown>): ReportRowSets {
  const quoteRows = (v: unknown): QuoteRow[] =>
    (Array.isArray(v) ? v : []).map((x) =>
      toQuoteRow(x as Record<string, unknown>)
    );

  return {
    statuses: (Array.isArray(r.statuses) ? r.statuses : []).map(
      (s: { status: string; count: number }) => ({
        status: String(s.status),
        count: Number(s.count),
      })
    ),
    series: (Array.isArray(r.series) ? r.series : []).map(
      (m: { bucket: string; quotes: number; accepted: number }) => ({
        name: String(m.bucket),
        quotes: Number(m.quotes),
        acceptedCents: Number(m.accepted),
      })
    ),
    queues: {
      toPrice: quoteRows(r.queue_to_price),
      needsDriver: quoteRows(r.queue_needs_driver),
      storageAtRisk: quoteRows(r.queue_storage_at_risk),
      escalationDue: quoteRows(r.queue_escalation_due),
    },
    recent: quoteRows(r.recent),
  };
}
