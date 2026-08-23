/**
 * ============================================================================
 * Expeditoo → Expedion write-back
 * ============================================================================
 *
 * The return leg of the escalation bridge. When a carrier wins an escalated
 * job, or that job's shipment moves, the Expedion client has to see it without
 * leaving their app (expedion_encheres ROADMAP.md §8 Phase D).
 *
 * This lives apart from `expedion-escalation.service.ts` on purpose. The
 * outbound leg needs `listingsService` to create a listing, and
 * `listingsService` imports `offersService` — so calling the write-back from
 * inside `offersService` through that module would close an import cycle.
 * Everything here reaches only for the DAL.
 *
 * Every hook is a no-op for `direct` listings. Expeditoo's own flows call them
 * unconditionally and must not pay for a bridge they are not using, so the
 * first thing each one does is ask whether a quote is linked at all.
 */

import { nanoid } from "nanoid";
import { db } from "@/db";
import { carriersDal } from "@/server/dal/carriers.dal";
import { expedionDal } from "@/server/dal/expedion.dal";
import { expedionSmsService } from "@/server/services/expedion-sms.service";
import { notifyExpedionAdmins } from "@/server/services/expedion-realtime.service";
import {
  ExpedionError,
  canTransition,
} from "@/server/services/expedion.service";
import type { ExpedionQuoteStatus } from "@/db/schema/expedion";
import type { ExpedionWriteBackInput } from "@/server/dto/expedion.dto";

const err = (code: string, status: number, message?: string) =>
  new ExpedionError(code, status, message);

/**
 * Expeditoo's shipment states, mapped onto the Expedion lifecycle.
 *
 * `IN_TRANSIT` deliberately maps to `picked_up`: Expedion's client-facing
 * lifecycle has no separate in-transit stage, and collapsing it is better than
 * inventing one the rest of the app does not understand.
 */
const SHIPMENT_STATUS_MAP: Record<string, ExpedionQuoteStatus | undefined> = {
  PENDING: undefined,
  ASSIGNED: "assigned",
  PICKED_UP: "picked_up",
  IN_TRANSIT: "picked_up",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
};

/**
 * `input.carrierId` is a **user id** — that is what `offers.carrier_id` and
 * `shipments.carrier_id` hold — but `expedion_quotes.assigned_carrier_id`
 * references `carriers.id`. Writing one into the other raised a foreign-key
 * violation on every award of an escalated job, and `notifyExpedion` swallowed
 * it, so the award succeeded and the Expedion client was never told which
 * carrier won. The quote then sat at `escalated` for good.
 *
 * Returns null rather than throwing when there is no carrier row: this runs
 * downstream of an award that has already happened, and refusing to record it
 * would lose the status change as well as the carrier.
 */
async function resolveCarrierRowId(userId: string): Promise<string | null> {
  const carrier = await carriersDal.getByUserId(userId);
  if (!carrier) {
    console.error(
      `[expedion] no carrier row for user ${userId}; ` +
        `recording the status change without the driver`
    );
    return null;
  }
  return carrier.id;
}

export const expedionBridgeService = {
  /**
   * Applies a status change from the Expeditoo side onto the linked quote.
   *
   * Throws when called for a listing with no quote behind it, because the HTTP
   * route needs to report that as a 404 — the silent variants below are the
   * ones Expeditoo's internal flows call.
   */
  async writeBack(input: ExpedionWriteBackInput) {
    const quote = await expedionDal.getByListingId(input.listingId);
    if (!quote) {
      throw err(
        "QUOTE_NOT_FOUND",
        404,
        `No Expedion quote is linked to listing ${input.listingId}`
      );
    }

    if (!canTransition(quote.status, input.status)) {
      throw err(
        "INVALID_TRANSITION",
        409,
        `${quote.status} → ${input.status} is not a legal transition`
      );
    }

    const carrierRowId = input.carrierId
      ? await resolveCarrierRowId(input.carrierId)
      : null;

    const updated = await db.transaction(async (tx) => {
      const row = await expedionDal.update(
        quote.id,
        {
          status: input.status,
          ...(carrierRowId
            ? { assignedCarrierId: carrierRowId, assignedAt: new Date() }
            : {}),
        },
        tx
      );
      await expedionDal.addEvent(
        {
          id: nanoid(),
          quoteId: quote.id,
          status: input.status,
          actor: "expeditoo",
          actorId: input.carrierId ?? undefined,
          message: input.message ?? null,
          metadata: {
            ...(input.metadata ?? {}),
            listingId: input.listingId,
            // Both ids on the timeline: the user id is what Expeditoo's own
            // tables key on, and without it a support question about "which
            // driver" has to be answered by joining backwards from a column
            // that may be null.
            ...(input.carrierId ? { carrierUserId: input.carrierId } : {}),
            ...(input.carrierId && !carrierRowId
              ? { carrierRowMissing: true }
              : {}),
          },
        },
        tx
      );
      return row;
    });

    void notifyExpedionAdmins(quote.id);

    if (input.carrierId && !quote.assignedCarrierId) {
      void expedionSmsService
        .driverAssigned({
          phone: updated.phone,
          firstName: updated.firstName,
          pickupCity: updated.pickupCity,
        })
        .catch(() => undefined);
    } else if (input.status === "picked_up" || input.status === "delivered") {
      void expedionSmsService
        .deliveryUpdate({
          phone: updated.phone,
          status: input.status,
          bordereauNumber: updated.bordereauNumber,
        })
        .catch(() => undefined);
    }

    return updated;
  },

  /**
   * A carrier won the bidding on an escalated job.
   *
   * This is the moment that satisfies Phase D's exit criterion: the Expedion
   * client sees the selected carrier without a manual step.
   */
  async onOfferAccepted(params: {
    listingId: string;
    carrierId: string;
    priceCents?: number;
  }): Promise<void> {
    const quote = await expedionDal.getByListingId(params.listingId);
    if (!quote) return; // A `direct` listing — nothing to write back to.

    await this.writeBack({
      listingId: params.listingId,
      status: "assigned",
      carrierId: params.carrierId,
      message: "Un transporteur a été retenu via Expeditoo",
      metadata: params.priceCents ? { priceCents: params.priceCents } : {},
    });
  },

  /** The shipment behind an escalated job moved. */
  async onShipmentStatus(params: {
    listingId: string;
    shipmentStatus: string;
  }): Promise<void> {
    const status = SHIPMENT_STATUS_MAP[params.shipmentStatus];
    if (!status) return; // Nothing meaningful to say on the Expedion side.

    const quote = await expedionDal.getByListingId(params.listingId);
    if (!quote) return;
    // Re-reporting a state we are already in is normal, not an error.
    if (quote.status === status) return;
    if (!canTransition(quote.status, status)) return;

    await this.writeBack({
      listingId: params.listingId,
      status,
      message: {
        assigned: "Transporteur assigné",
        picked_up: "Lot retiré, livraison en cours",
        delivered: "Lot livré",
        cancelled: "Transport annulé",
      }[status as string],
      metadata: { shipmentStatus: params.shipmentStatus },
    });
  },
};

/**
 * Fire-and-forget wrapper for Expeditoo's own flows.
 *
 * A failure to notify Expedion must never roll back an accepted offer or a
 * recorded delivery — the marketplace transaction is the thing that matters,
 * and the bridge is downstream of it. Failures are logged and the sweep in
 * `runAutoEscalation` is not affected.
 */
export function notifyExpedion(work: Promise<void>): void {
  void work.catch((error) => {
    console.error("[expedion] write-back failed", error);
  });
}
