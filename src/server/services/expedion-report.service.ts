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
 * Every section is loaded independently and is allowed to fail alone. The
 * aggregates run against tables at different migration stages, so one query
 * meeting a column that is not there yet is a normal Tuesday — and it should
 * cost the operator that one card, not the eight beside it that were fine.
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
 * Loads one section, degrading to its placeholder instead of taking the report
 * down. The error is logged and not returned: the route tells the client
 * nothing about internals, and the section list already says *which* figure to
 * distrust, which is all the page can act on anyway.
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

export async function getExpedionReport(): Promise<ExpedionReport> {
  const [
    quotes,
    statuses,
    marketplace,
    health,
    series,
    queues,
    recent,
    platform,
  ] = await Promise.all([
    section("quotes", NO_QUOTES, () => reportDal.getExpedionTotals()),
    section<reportDal.StatusCount[]>("statuses", [], () =>
      reportDal.getStatusBreakdown()
    ),
    section("marketplace", NO_MARKETPLACE, () =>
      reportDal.getMarketplaceTotals()
    ),
    section("health", NO_HEALTH, () => reportDal.getDataHealth()),
    section<reportDal.MonthPoint[]>("series", [], () =>
      reportDal.getMonthlySeries()
    ),
    // The four queues stand or fall together on purpose: they are the same
    // projection over the same table, so whatever breaks one breaks the rest,
    // and a partial tab strip would be a lie about the work outstanding.
    section<Record<reportDal.QueueKind, reportDal.QuoteRow[]>>(
      "queues",
      { toPrice: [], needsDriver: [], storageAtRisk: [], escalationDue: [] },
      async () => {
        const [toPrice, needsDriver, storageAtRisk, escalationDue] =
          await Promise.all([
            reportDal.getQueue("toPrice"),
            reportDal.getQueue("needsDriver"),
            reportDal.getQueue("storageAtRisk"),
            reportDal.getQueue("escalationDue"),
          ]);
        return { toPrice, needsDriver, storageAtRisk, escalationDue };
      }
    ),
    section<reportDal.QuoteRow[]>("recent", [], () =>
      reportDal.getRecentQuotes()
    ),
    // Grouped so the flag means one thing: every figure under `platform` is
    // either counted or placeholder, never a mix the UI would have to unpick.
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

  const sections = [
    quotes,
    statuses,
    marketplace,
    health,
    series,
    queues,
    recent,
    platform,
  ];

  return {
    quotes: quotes.value,
    statuses: statuses.value,
    marketplace: marketplace.value,
    health: health.value,
    series: series.value,
    queues: queues.value,
    recent: recent.value,
    platform: platform.value,
    unavailable: sections.filter((s) => s.failed).map((s) => s.key),
    provisional: {
      paymentsUnobserved: true,
      mockPayments: process.env.MOCK_PAYMENTS === "true",
      payoutsIncomplete: true,
    },
  };
}
