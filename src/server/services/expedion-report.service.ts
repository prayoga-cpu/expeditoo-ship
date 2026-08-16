import * as adminDal from "@/server/dal/admin.dal";
import * as reportDal from "@/server/dal/expedion-report.dal";

/**
 * Composes the operator report.
 *
 * The Expeditoo-side figures come from `admin.dal` rather than being
 * re-derived here — that module already defines what "active driver" and
 * "app fees" mean, and a second definition would drift from the one the rest
 * of the admin area shows.
 */

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
   * Figures whose underlying pipeline is incomplete, so the UI can label them
   * rather than present them as accounts. Computed here so the caveat travels
   * with the data instead of living in a component's memory.
   */
  provisional: {
    /** Payments run behind MOCK_PAYMENTS in non-production. */
    mockPayments: boolean;
    /** Payouts are created but never leave `scheduled`. */
    payoutsIncomplete: boolean;
  };
}

export async function getExpedionReport(): Promise<ExpedionReport> {
  const [
    quotes,
    statuses,
    marketplace,
    health,
    series,
    toPrice,
    needsDriver,
    storageAtRisk,
    escalationDue,
    recent,
    appFeesCents,
    activeUsers,
    activeDrivers,
    pendingDeliveries,
  ] = await Promise.all([
    reportDal.getExpedionTotals(),
    reportDal.getStatusBreakdown(),
    reportDal.getMarketplaceTotals(),
    reportDal.getDataHealth(),
    reportDal.getMonthlySeries(),
    reportDal.getQueue("toPrice"),
    reportDal.getQueue("needsDriver"),
    reportDal.getQueue("storageAtRisk"),
    reportDal.getQueue("escalationDue"),
    reportDal.getRecentQuotes(),
    adminDal.getTotalAppFees(),
    adminDal.getActiveUsersCount(),
    adminDal.getActiveDriversCount(),
    adminDal.getPendingDeliveriesCount(),
  ]);

  return {
    quotes,
    statuses,
    marketplace,
    health,
    series,
    queues: { toPrice, needsDriver, storageAtRisk, escalationDue },
    recent,
    platform: {
      appFeesCents: Number(appFeesCents ?? 0),
      activeUsers: Number(activeUsers ?? 0),
      activeDrivers: Number(activeDrivers ?? 0),
      pendingDeliveries: Number(pendingDeliveries ?? 0),
    },
    provisional: {
      mockPayments: process.env.MOCK_PAYMENTS === "true",
      payoutsIncomplete: true,
    },
  };
}
