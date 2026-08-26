import { and, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { shipments } from "@/db/schema/shipments";
import { listings } from "@/db/schema/listings";
import { payments, payouts } from "@/db/schema/payments";

// ========================================
// Earnings DAL
// ========================================
// One row per delivered shipment the carrier drove, joined to the money that
// was recorded against it (billing_documents_spec.md §3.1).
//
// The joins are LEFT on purpose: a delivery that happened is history whether or
// not a payment row was ever written for it, and dropping such a row would make
// the carrier's own record of their work incomplete.

interface EarningsFilters {
  from?: Date;
  to?: Date;
}

function scope(carrierUserId: string, filters: EarningsFilters): SQL {
  const conditions: SQL[] = [
    eq(shipments.carrierId, carrierUserId),
    eq(shipments.status, "DELIVERED"),
  ];

  if (filters.from) conditions.push(gte(shipments.deliveredAt, filters.from));
  if (filters.to) conditions.push(lte(shipments.deliveredAt, filters.to));

  return and(...conditions)!;
}

export const earningsDal = {
  async listForCarrier(
    carrierUserId: string,
    filters: EarningsFilters & { page: number; limit: number }
  ) {
    const where = scope(carrierUserId, filters);

    const rows = await db
      .select({
        shipmentId: shipments.id,
        listingId: shipments.listingId,
        listingTitle: listings.title,
        origin: listings.origin,
        externalRef: listings.externalRef,
        deliveredAt: shipments.deliveredAt,
        pickupCity: listings.pickupCity,
        dropoffCity: listings.dropoffCity,
        pickupAddress: shipments.pickupAddress,
        dropoffAddress: shipments.dropoffAddress,
        priceCents: shipments.priceCents,
        grossCents: payments.amountCents,
        commissionCents: payments.commissionCents,
        capturedAt: payments.capturedAt,
        paymentStatus: payments.status,
        netCents: payouts.amountCents,
        payoutStatus: payouts.status,
        paidAt: payouts.paidAt,
      })
      .from(shipments)
      .leftJoin(listings, eq(listings.id, shipments.listingId))
      .leftJoin(payments, eq(payments.shipmentId, shipments.id))
      .leftJoin(payouts, eq(payouts.shipmentId, shipments.id))
      .where(where)
      .orderBy(desc(shipments.deliveredAt))
      .limit(filters.limit)
      .offset((filters.page - 1) * filters.limit);

    return rows;
  },

  /**
   * Totals over the whole filtered set, not the page. Summing the page would
   * make the header disagree with itself the moment a carrier paginates.
   */
  async summariseForCarrier(carrierUserId: string, filters: EarningsFilters) {
    const where = scope(carrierUserId, filters);

    const [row] = await db
      .select({
        deliveries: sql<number>`count(*)`,
        grossCents: sql<number>`coalesce(sum(${payments.amountCents}), 0)`,
        commissionCents: sql<number>`coalesce(sum(${payments.commissionCents}), 0)`,
        netCents: sql<number>`coalesce(sum(${payouts.amountCents}), 0)`,
        paidCents: sql<number>`coalesce(sum(case when ${payouts.status} = 'paid' then ${payouts.amountCents} else 0 end), 0)`,
        pendingCents: sql<number>`coalesce(sum(case when ${payouts.status} is not null and ${payouts.status} <> 'paid' then ${payouts.amountCents} else 0 end), 0)`,
      })
      .from(shipments)
      .leftJoin(payments, eq(payments.shipmentId, shipments.id))
      .leftJoin(payouts, eq(payouts.shipmentId, shipments.id))
      .where(where);

    return {
      deliveries: Number(row?.deliveries ?? 0),
      grossCents: Number(row?.grossCents ?? 0),
      commissionCents: Number(row?.commissionCents ?? 0),
      netCents: Number(row?.netCents ?? 0),
      paidCents: Number(row?.paidCents ?? 0),
      pendingCents: Number(row?.pendingCents ?? 0),
    };
  },
};

export type EarningsRow = Awaited<
  ReturnType<typeof earningsDal.listForCarrier>
>[number];
