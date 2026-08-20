import * as adminDal from "@/server/dal/admin.dal";
import * as reportDal from "@/server/dal/expedion-report.dal";

/**
 * Composes the operator report.
 *
 * The Expeditoo-side figures come from `admin.dal` rather than being
 * re-derived here — that module already defines what "active driver" and
 * "app fees" mean, and a second definition would drift from the one the rest
 * of the admin area shows.
 *
 * The eight sections are loaded by three concurrent queries — the scalars, the
 * row sets, and the four platform figures — rather than the eighteen this used
 * to issue. That is not tidiness: postgres.js pipelines onto a busy connection
 * once its pool is exhausted, Supabase's transaction pooler does not answer
 * pipelined work, and eighteen in flight against a pool of ten hung the page
 * indefinitely rather than failing.
 *
 * Failure is still per section, because that is what the page can act on. The
 * aggregates run against tables at different migration stages, so one query
 * meeting a column that is not there yet is a normal Tuesday — and it should
 * cost the operator those cards, not the ones beside them that were fine. A
 * batch that throws therefore names every section it was carrying, and the
 * groups are drawn so the sections that fail together are ones an operator
 * would not try to read against each other anyway.
 */

/** One independently-loaded part of the report; the fields below, one for one. */
export type ExpedionReportSection =
  | "quotes"
  | "statuses"
  | "marketplace"
  | "health"
  | "series"
  | "queues"
  | "recent"
  | "platform";

export interface ExpedionReport {
  quotes: reportDal.ExpedionTotals;
  statuses: reportDal.StatusCount[];
  marketplace: reportDal.MarketplaceTotals;
  health: reportDal.DataHealth;
  series: reportDal.MonthPoint[];
  queues: Record<reportDal.QueueKind, reportDal.QuoteRow[]>;
  recent: reportDal.QuoteRow[];
  platform: {
    appFeesCents: number;
    activeUsers: number;
    activeDrivers: number;
    pendingDeliveries: number;
  };
  /**
   * Sections whose query threw. Their field still arrives, zero-filled, so the
   * rest of the page renders — which is exactly why this list has to exist: a
   * placeholder zero and a counted zero are the same bytes on the wire, and
   * "0 EUR collected" is a far more dangerous thing to put in front of an
   * operator than "we could not ask". Anything named here must be rendered as
   * unavailable, not as its value.
   *
   * Optional so a consumer written against the older shape still compiles;
   * the service always sends it, empty when nothing failed.
   */
  unavailable?: ExpedionReportSection[];
  /**
   * Figures whose underlying pipeline is incomplete, so the UI can label them
   * rather than present them as accounts. Computed here so the caveat travels
   * with the data instead of living in a component's memory.
   */
  provisional: {
    /**
     * Nothing on this side ever sees an Expedion payment happen.
     * `quotes.paidValueCents` counts quotes whose `paymentStatus` reached
     * `paid`, and only `expedionService.markPaid` writes that — no Stripe
     * webhook can, because `expedion_quotes` carries no payment intent for a
     * webhook to recognise. Payment has to be reported to us from the Expedion
     * side, so a zero collected means "nothing reported", never "nothing
     * paid". Constant rather than an environment switch: production has the
     * same hole, and this is the caveat that belongs on the collected figure.
     *
     * Optional for the same reason as `unavailable`; always sent.
     */
    paymentsUnobserved?: boolean;
    /**
     * MOCK_PAYMENTS short-circuits Stripe on the *marketplace* path, so
     * `platform.appFeesCents` may be summing synthetic captures. It never
     * touches an Expedion quote, so it says nothing about what was collected —
     * commission is the number it qualifies.
     */
    mockPayments: boolean;
    /** Payouts are created but never leave `scheduled`. */
    payoutsIncomplete: boolean;
  };
}

/**
 * What a failed section renders as. Typed against the DAL's own interfaces so
 * that a new aggregate field has to be given a placeholder here rather than
 * silently reaching a client that trusts the field exists.
 */
const NO_QUOTES: reportDal.ExpedionTotals = {
  total: 0,
  unowned: 0,
  awaitingPricing: 0,
  awaitingPayment: 0,
  needsDriver: 0,
  escalated: 0,
  assigned: 0,
  delivered: 0,
  cancelled: 0,
  storageAtRisk: 0,
  escalationDue: 0,
  acceptedValueCents: 0,
  paidValueCents: 0,
  insuredShare: 0,
};

const NO_MARKETPLACE: reportDal.MarketplaceTotals = {
  expedionListings: 0,
  directListings: 0,
  offersOnExpedionJobs: 0,
  expedionShipments: 0,
  deliveredShipments: 0,
  carriersApproved: 0,
  carriersPending: 0,
  activeVehicles: 0,
};

const NO_HEALTH: reportDal.DataHealth = {
  unowned: 0,
  missingPickupCoords: 0,
  missingDimensions: 0,
  meanExtractionConfidence: null,
  extracted: 0,
};

const NO_PLATFORM: ExpedionReport["platform"] = {
  appFeesCents: 0,
  activeUsers: 0,
  activeDrivers: 0,
  pendingDeliveries: 0,
};

interface Section<T> {
  key: ExpedionReportSection;
  value: T;
  failed: boolean;
}

/**
 * Loads one batch, degrading to its placeholder instead of taking the report
 * down. The error is logged and not returned: the route tells the client
 * nothing about internals, and the section list already says *which* figure to
 * distrust, which is all the page can act on anyway.
 *
 * `key` names the batch in the log only. What reaches the client is the fanned
 * out list at the bottom of `getExpedionReport`, because a section name the
 * page does not recognise reads to it as "that section is fine".
 */
async function section<T>(
  key: ExpedionReportSection,
  fallback: T,
  load: () => Promise<T>
): Promise<Section<T>> {
  try {
    return { key, value: await load(), failed: false };
  } catch (error) {
    console.error(`[expedion-report] section "${key}" unavailable`, error);
    return { key, value: fallback, failed: true };
  }
}

const NO_ROW_SETS: reportDal.ReportRowSets = {
  statuses: [],
  series: [],
  queues: { toPrice: [], needsDriver: [], storageAtRisk: [], escalationDue: [] },
  recent: [],
};

/**
 * Which report sections each batched query answers for.
 *
 * The two loaders below each cover several sections, but `unavailable` stays
 * keyed by section because that is what the page reads: `ExpedionDashboard`
 * asks it about `statuses`, `queues` and `recent` by name, and a key it does
 * not recognise reads as "this section is fine". A failed batch therefore fans
 * out to every section it was carrying — otherwise one dead statement renders
 * four empty queues as "no work outstanding", which is the single thing the
 * `unavailable` contract exists to prevent.
 */
const SCALAR_SECTIONS = ["quotes", "marketplace", "health"] as const;
const ROW_SET_SECTIONS = ["statuses", "series", "queues", "recent"] as const;

export async function getExpedionReport(): Promise<ExpedionReport> {
  const [scalars, rowSets, platform] = await Promise.all([
    section<reportDal.ReportScalars>(
      "quotes",
      { quotes: NO_QUOTES, marketplace: NO_MARKETPLACE, health: NO_HEALTH },
      () => reportDal.getReportScalars()
    ),
    section<reportDal.ReportRowSets>("queues", NO_ROW_SETS, () =>
      reportDal.getReportRowSets()
    ),
    // Left as four concurrent calls rather than folded into the scalar query:
    // `admin.dal` owns what these four numbers mean for the whole admin area,
    // and they run alongside the two batches, so merging them would buy no
    // round trip. Grouped so the flag means one thing: every figure under
    // `platform` is either counted or placeholder, never a mix.
    section("platform", NO_PLATFORM, async () => {
      const [appFeesCents, activeUsers, activeDrivers, pendingDeliveries] =
        await Promise.all([
          adminDal.getTotalAppFees(),
          adminDal.getActiveUsersCount(),
          adminDal.getActiveDriversCount(),
          adminDal.getPendingDeliveriesCount(),
        ]);

      return {
        appFeesCents: Number(appFeesCents ?? 0),
        activeUsers: Number(activeUsers ?? 0),
        activeDrivers: Number(activeDrivers ?? 0),
        pendingDeliveries: Number(pendingDeliveries ?? 0),
      };
    }),
  ]);

  const unavailable: ExpedionReportSection[] = [
    ...(scalars.failed ? SCALAR_SECTIONS : []),
    ...(rowSets.failed ? ROW_SET_SECTIONS : []),
    ...(platform.failed ? (["platform"] as const) : []),
  ];

  return {
    quotes: scalars.value.quotes,
    statuses: rowSets.value.statuses,
    marketplace: scalars.value.marketplace,
    health: scalars.value.health,
    series: rowSets.value.series,
    queues: rowSets.value.queues,
    recent: rowSets.value.recent,
    platform: platform.value,
    unavailable,
    provisional: {
      paymentsUnobserved: true,
      mockPayments: process.env.MOCK_PAYMENTS === "true",
      payoutsIncomplete: true,
    },
  };
}
