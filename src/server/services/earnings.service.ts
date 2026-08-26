import { z } from "zod";
import { earningsDal, type EarningsRow } from "@/server/dal/earnings.dal";
import { carrierService } from "@/server/services/carrier.service";
import { COMMISSION_RATE } from "@/server/services/payments.service";

// ========================================
// Errors
// ========================================

export class EarningsError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message?: string
  ) {
    super(message ?? code);
    this.name = "EarningsError";
  }
}

const err = (code: string, status: number, message?: string) =>
  new EarningsError(code, status, message);

// ========================================
// Query
// ========================================

/** A statement wider than this is refused rather than held open on a render. */
export const MAX_STATEMENT_ROWS = 500;

export const earningsQuerySchema = z
  .object({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .refine((q) => !q.from || !q.to || q.from <= q.to, {
    path: ["to"],
    message: "INVALID_PERIOD",
  });

export type EarningsQuery = z.infer<typeof earningsQuerySchema>;

// ========================================
// Mapping
// ========================================

/**
 * A delivered shipment with no payment row reports zeros rather than being
 * dropped (billing_documents_spec.md §3.1). `priceCents` is kept beside the
 * gross so a legacy row still shows what the job was awarded at.
 */
function toItem(row: EarningsRow) {
  return {
    shipmentId: row.shipmentId,
    listingId: row.listingId,
    listingTitle: row.listingTitle ?? null,
    reference: row.externalRef ?? row.shipmentId,
    deliveredAt: row.deliveredAt,
    pickupCity: row.pickupCity ?? row.pickupAddress,
    dropoffCity: row.dropoffCity ?? row.dropoffAddress,
    priceCents: row.priceCents,
    grossCents: row.grossCents ?? 0,
    commissionCents: row.commissionCents ?? 0,
    netCents: row.netCents ?? 0,
    capturedAt: row.capturedAt ?? null,
    paymentStatus: row.paymentStatus ?? null,
    payoutStatus: row.payoutStatus ?? null,
    paidAt: row.paidAt ?? null,
  };
}

export type EarningsItem = ReturnType<typeof toItem>;

// ========================================
// Service
// ========================================

export const earningsService = {
  /**
   * What the carrier earned, as the ledger actually records it.
   *
   * `commissionRetainsAll` is surfaced so the screen can explain a €0.00 net
   * rather than leaving the carrier to decide whether it is a bug: while
   * `COMMISSION_RATE` is 1 the platform keeps everything by decision, and no
   * payout is due (billing_documents_spec.md §2).
   */
  async getForCarrier(userId: string, query: EarningsQuery) {
    await carrierService.requireOwnCarrier(userId);

    const [rows, summary] = await Promise.all([
      earningsDal.listForCarrier(userId, query),
      earningsDal.summariseForCarrier(userId, query),
    ]);

    return {
      items: rows.map(toItem),
      summary,
      total: summary.deliveries,
      page: query.page,
      limit: query.limit,
      totalPages: Math.max(1, Math.ceil(summary.deliveries / query.limit)),
      commissionRetainsAll: COMMISSION_RATE >= 1,
    };
  },

  /** Every row in the period, for the PDF. Capped, never paginated. */
  async getStatementRows(
    userId: string,
    period: { from?: Date; to?: Date }
  ) {
    const carrier = await carrierService.requireOwnCarrier(userId);

    const summary = await earningsDal.summariseForCarrier(userId, period);
    if (summary.deliveries > MAX_STATEMENT_ROWS) {
      throw err(
        "STATEMENT_TOO_LARGE",
        400,
        `Narrow the period: ${summary.deliveries} deliveries exceeds the ${MAX_STATEMENT_ROWS} row limit`
      );
    }

    const rows = await earningsDal.listForCarrier(userId, {
      ...period,
      page: 1,
      limit: MAX_STATEMENT_ROWS,
    });

    return {
      carrier,
      items: rows.map(toItem),
      summary,
      commissionRetainsAll: COMMISSION_RATE >= 1,
    };
  },
};
