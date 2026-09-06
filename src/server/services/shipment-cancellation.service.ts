/**
 * ============================================================================
 * Cancellations, from both sides
 * ============================================================================
 *
 * Two verbs, because a requester and a transporter are not stopping the same
 * thing.
 *
 *   **cancelJob**       the job is off. The listing dies, the bids die, the
 *                       money goes back.
 *   **withdrawFromJob** *this* transporter is off. The client still wants the
 *                       delivery and has already paid for it, so the job goes
 *                       back on the board and somebody else takes it.
 *
 * This used to be one branchless block in `shipment.service.ts` that any party
 * could reach, and it always took the first outcome — so a van breaking down
 * destroyed a paid client's delivery with no way back.
 *
 * It lives here rather than there because un-awarding needs `offersService`,
 * and `listingsService` already imports that: the same import-cycle pressure
 * that produced `shipment-access.ts` and `message-publish.ts`. Nothing may
 * import this module back into `shipment.service.ts`.
 *
 * See docs/specs/cancellations_spec.md.
 */

import { nanoid } from "nanoid";
import { listingsDal } from "@/server/dal/listings.dal";
import { offersDal } from "@/server/dal/offers.dal";
import { shipmentsDal } from "@/server/dal/shipments.dal";
import { userHasRole } from "@/server/dal/users.dal";
import { notificationsService } from "@/server/services/notifications.service";
import { offersService } from "@/server/services/offers.service";
import { paymentsService } from "@/server/services/payments.service";
import {
  expedionBridgeService,
  notifyExpedion,
} from "@/server/services/expedion-bridge.service";
import {
  expedionService,
  type ExpedionCallerIdentity,
} from "@/server/services/expedion.service";
import {
  partyFor,
  shipmentErr,
  type Viewer,
} from "@/server/services/shipment-access";
import {
  canCancelAs,
  canWithdrawAs,
  isCategoryForSide,
  requiresSupport,
  sideFor,
  type CancellationCategory,
  type CancellationParty,
  type CancellationSide,
} from "@/lib/cancellation-policy";
import type {
  CancelJobInput,
  WithdrawFromJobInput,
} from "@/server/dto/cancellation.dto";
import type { ActorRoleType } from "@/db/schema/shipments";
import type { Listing } from "@/db/schema/listings";

const err = shipmentErr;

/**
 * What `getOwnership` actually returns. `ShipmentOwnership` in
 * `shipment-access.ts` is only the three party columns `partyFor` needs; this
 * path also reads the status and the listing.
 */
type JobOwnership = NonNullable<
  Awaited<ReturnType<typeof shipmentsDal.getOwnership>>
>;

// ========================================
// Who is asking
// ========================================

/**
 * A cancellation can arrive from a session or from an Expedion quote owner, who
 * has no `user` row at all and reaches the app through the quote route.
 */
export type CancellationActor =
  | { kind: "session"; viewer: Viewer }
  | { kind: "quoteOwner"; ref: string }
  /**
   * An operator acting on the quote lane. `getQuote` lets an admin through for
   * *any* quote, so without this every staff cancellation on that inlet would
   * be recorded as the client's own — and the client's own screen would then
   * read "Annulée par le client" for something they never did.
   * `attestForQuote` draws the same distinction, for the same reason.
   */
  | { kind: "operatorForQuote"; ref: string };

interface ResolvedActor {
  side: CancellationSide;
  party: CancellationParty | null;
  userId: string | null;
  ref: string | null;
  actorRole: ActorRoleType;
}

const ROLE_FOR_PARTY: Record<CancellationParty, ActorRoleType> = {
  shipper: "shipper",
  carrier: "carrier",
  driver: "driver",
  // `recordEvent` in shipment.service collapses staff onto `admin`; this path
  // does not, because "who cancelled" is exactly the question the record has to
  // answer and `operator` is a value the enum already has.
  staff: "operator",
};

/**
 * The party says what the viewer is to this shipment; the side says what they
 * are commercially. Only the inlet separates them — and on the escalated inlet
 * the `shipper` seat is the Expedion system account, which nobody signs into.
 *
 * That seat is refused unless the caller genuinely holds an operator or admin
 * role. An admin may impersonate the system account (only self-impersonation is
 * refused), and `partyFor` resolves `shipper` before `staff`, so without this a
 * borrowed session is one click from cancelling a real client's paid job and
 * having it audited as the machine.
 */
function resolveActor(
  ownership: JobOwnership,
  listing: Listing,
  actor: CancellationActor
): ResolvedActor {
  if (actor.kind === "quoteOwner" || actor.kind === "operatorForQuote") {
    const onBehalf = actor.kind === "operatorForQuote";
    return {
      side: onBehalf ? "operator" : "requester",
      party: null,
      userId: null,
      // Who *acted*, which on the operator lane is not who the job belongs to.
      ref: actor.ref,
      actorRole: onBehalf ? "operator" : "shipper",
    };
  }

  const party = partyFor(ownership, actor.viewer);
  if (party === "none") throw err("FORBIDDEN", 403);

  const isStaff = Boolean(actor.viewer.isAdmin || actor.viewer.isOperator);
  if (party === "shipper" && listing.origin === "expedion" && !isStaff) {
    throw err("CANCEL_SYSTEM_ACCOUNT_FORBIDDEN", 403);
  }

  return {
    side: sideFor(party, listing.origin),
    party,
    userId: actor.viewer.userId,
    ref: null,
    actorRole: ROLE_FOR_PARTY[party],
  };
}

function assertCategory(side: CancellationSide, category: CancellationCategory) {
  if (!isCategoryForSide(side, category)) {
    throw err("CATEGORY_NOT_FOR_SIDE", 400);
  }
}

// ========================================
// Money
// ========================================

/**
 * Gives the money back, and never fails the cancellation doing it.
 *
 * The swallow is deliberate and predates this module: refusing to record that a
 * job is off because Stripe was briefly unreachable leaves a job nobody is
 * doing marked live. It is narrowed here rather than widened —
 * `REFUND_NOT_LOCAL` is caught by name because it is the *expected* answer for
 * money Expedion took, and anything else is reported back so it can be stamped
 * on the event. A dead Stripe call should be visible to support, not only to a
 * server log (cancellations_spec.md §6.2).
 */
async function settleMoney(
  listing: Listing,
  shipmentId: string
): Promise<{ refundFailed: boolean }> {
  // The driver's side of the ledger, first and unconditionally: the payout is
  // scheduled by the Stripe webhook at capture — award time — so it can exist
  // before anyone has driven anywhere, and it counts as withdrawable money
  // until something says otherwise.
  await paymentsService
    .cancelPayoutForShipment(shipmentId)
    .catch((e) => console.error("[cancellation] payout void failed", e));

  try {
    await paymentsService.refundForJob(listing.id);
    return { refundFailed: false };
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === "REFUND_NOT_LOCAL") {
      // Expected: that money moved in Expedion and is refunded there. The
      // refund-owed record is written by the bridge.
      return { refundFailed: false };
    }
    console.error(`[cancellation] refund failed for listing ${listing.id}`, error);
    return { refundFailed: true };
  }
}

// ========================================
// Writes
// ========================================

async function recordCancellation(
  shipmentId: string,
  previousStatus: JobOwnership["status"],
  who: ResolvedActor,
  input: CancelJobInput | WithdrawFromJobInput,
  refundFailed: boolean
) {
  await shipmentsDal.createEvent({
    id: nanoid(),
    shipmentId,
    status: "CANCELLED",
    previousStatus,
    actorId: who.userId,
    actorRole: who.actorRole,
    note: input.reason ?? null,
    metadata: JSON.stringify({
      side: who.side,
      category: input.category,
      ...(who.ref ? { quoteOwnerRef: who.ref } : {}),
      ...(refundFailed ? { refundFailed: true } : {}),
    }),
  });
}

/** The job is over: no more bids, no award, nothing on the board. */
async function closeListing(listing: Listing) {
  await offersService.expirePendingOffers(listing.id);
  if (listing.acceptedOfferId) {
    await offersDal.updateStatus(listing.acceptedOfferId, "rejected");
  }
  await listingsDal.update(listing.id, {
    status: "cancelled",
    acceptedOfferId: null,
    offersCount: 0,
  });
}

/** The bids this award had rejected, which a re-board puts back in play. */
async function rejectedRivalIds(listingId: string): Promise<string[]> {
  const rivals = await offersDal.listByListing(listingId);
  return rivals
    .filter((offer) => offer.status === "rejected")
    .map((offer) => offer.id);
}

// ========================================
// Telling the other side
// ========================================

async function notify(
  userId: string,
  type: string,
  title: string,
  message: string,
  linkUrl: string,
  data: Record<string, unknown>
) {
  await notificationsService
    .createNotification({ userId, type, title, message, linkUrl, data })
    .catch((e) => console.error(`${type} notification failed`, e));
}

/**
 * An escalated job's requester has no `user` row — `notifications.user_id` is a
 * NOT NULL foreign key — and the seat that *does* exist is the system account,
 * which writing to succeeds and nobody reads. They are told by SMS from the
 * bridge instead.
 */
const canNotifyRequester = (listing: Listing) => listing.origin === "direct";

async function announceCancelled(
  ownership: JobOwnership,
  listing: Listing,
  who: ResolvedActor
) {
  const data = { shipmentId: ownership.id, listingId: listing.id };
  const targets = new Set([ownership.carrierId, ownership.driverId]);
  // An operator ending the run is news to the client too. A client ending their
  // own is not.
  if (who.side === "operator" && canNotifyRequester(listing)) {
    targets.add(ownership.shipperId);
  }

  for (const userId of targets) {
    if (!userId) continue;
    const isTransporter = userId !== ownership.shipperId;
    await notify(
      userId,
      "shipment_cancelled",
      "Transport annulé",
      `"${listing.title}" a été annulé.`,
      isTransporter
        ? `/driver/shipments/${ownership.id}`
        : `/deliveries/${ownership.id}`,
      data
    );
  }
}

async function announceWithdrawn(
  ownership: JobOwnership,
  listing: Listing,
  restoredCarrierIds: string[],
  side: CancellationSide
) {
  const data = { shipmentId: ownership.id, listingId: listing.id };

  // When an operator takes the award back, the carrier holding it is the one
  // person who must hear about it: they are planning around a real pickup time
  // and have just silently lost the job. The deleted `revokeAward` told them;
  // routing it through the shared verb dropped that, so it is restored here.
  // A carrier who withdrew themselves already knows.
  if (side === "operator") {
    for (const userId of new Set([ownership.carrierId, ownership.driverId])) {
      if (!userId) continue;
      await notify(
        userId,
        "shipment_withdrawn",
        "Une course vous a été retirée",
        `"${listing.title}" a été reprise et remise sur le tableau.`,
        `/driver/shipments/${ownership.id}`,
        data
      );
    }
  }

  if (canNotifyRequester(listing)) {
    await notify(
      ownership.shipperId,
      "shipment_withdrawn",
      "Votre transporteur s'est désisté",
      `"${listing.title}" est de nouveau proposé à d'autres transporteurs.`,
      `/listing/${listing.id}`,
      data
    );
  }

  // The rivals were told at award that somebody else had been chosen, and until
  // now were told nothing when the job came back.
  for (const carrierId of new Set(restoredCarrierIds)) {
    await notify(
      carrierId,
      "job_reopened",
      "Une course est de nouveau disponible",
      `"${listing.title}" est revenu sur le tableau. Votre offre est réactivée.`,
      `/listing/${listing.id}`,
      data
    );
  }
}

// ========================================
// Service
// ========================================

export const shipmentCancellationService = {
  /**
   * The job is off.
   *
   * A transporter is refused by name rather than flatly: ending a client's paid
   * job is not theirs to do, and `USE_WITHDRAW_ENDPOINT` names the verb that
   * works instead of leaving them to guess.
   */
  async cancelJob(
    shipmentId: string,
    input: CancelJobInput,
    actor: CancellationActor
  ) {
    const { ownership, listing } = await loadJob(shipmentId);
    const who = resolveActor(ownership, listing, actor);

    // A repeat finishes the job rather than answering "already done". The work
    // spans four tables and is not one transaction, so a run that flipped to
    // CANCELLED and then failed on the listing or the bridge would otherwise be
    // unrepairable: every recovery route lands back here (§8.2).
    if (ownership.status === "CANCELLED") {
      return await finishCancel(ownership, listing, who.side, input.reason);
    }
    if (who.side === "transporter") throw err("USE_WITHDRAW_ENDPOINT", 409);
    assertCategory(who.side, input.category);
    assertCancellable(who.side, ownership.status);
    assertCurrentRun(listing, ownership);

    const { refundFailed } = await settleMoney(listing, shipmentId);

    const shipment = await shipmentsDal.cancel(shipmentId, {
      reason: input.reason ?? null,
      side: who.side,
      category: input.category,
      byUserId: who.userId,
      byRef: who.ref,
    });
    await recordCancellation(
      shipmentId,
      ownership.status,
      who,
      input,
      refundFailed
    );
    await settleCancelledJob(listing, who.side, input.reason ?? null);
    await announceCancelled(ownership, listing, who);

    return { shipment, alreadyCancelled: false };
  },

  /**
   * This transporter is off; the job is not.
   *
   * The money is given back first and deliberately: the client is owed it the
   * moment nobody is doing their job, and the replacement is charged at the
   * next award. Holding it instead would leave a driverless job's money with
   * the platform.
   */
  async withdrawFromJob(
    shipmentId: string,
    input: WithdrawFromJobInput,
    viewer: Viewer
  ) {
    const { ownership, listing } = await loadJob(shipmentId);
    const who = resolveActor(ownership, listing, { kind: "session", viewer });

    // As in `cancelJob`: a repeat finishes the work rather than no-opping, so
    // a withdrawal that died between the shipment row and the re-board can be
    // completed by retrying it (§8.2).
    if (ownership.status === "CANCELLED") {
      return await finishWithdraw(ownership, listing);
    }
    if (who.party === "driver") {
      throw err("FORBIDDEN_DRIVER_CANNOT_WITHDRAW", 403);
    }
    if (who.side === "requester") throw err("FORBIDDEN", 403);
    assertCategory(who.side, input.category);
    if (ownership.status === "DELIVERED") {
      throw err("INVALID_STATUS_TRANSITION", 409);
    }
    if (!canWithdrawAs(who.side, ownership.status)) {
      throw err("WITHDRAW_AFTER_PICKUP", 409);
    }
    assertCurrentRun(listing, ownership);

    const { refundFailed } = await settleMoney(listing, shipmentId);

    const shipment = await shipmentsDal.cancel(shipmentId, {
      reason: input.reason ?? null,
      side: who.side,
      category: input.category,
      byUserId: who.userId,
      byRef: who.ref,
    });
    await recordCancellation(
      shipmentId,
      ownership.status,
      who,
      input,
      refundFailed
    );

    const restored = await reboard(listing);

    notifyExpedion(expedionBridgeService.onAwardWithdrawn({ listingId: listing.id }));
    await announceWithdrawn(ownership, listing, restored, who.side);

    return { shipment, listingId: listing.id, alreadyCancelled: false };
  },

  /**
   * An operator takes an award back, addressed by listing rather than shipment.
   *
   * The same verb the transporter uses — one re-board path, not two. Before
   * this, the only way to undo an award was to cancel the shipment, which
   * destroyed the job.
   */
  async revokeAward(actorUserId: string, listingId: string, reason?: string) {
    const [isOperator, isAdmin] = await Promise.all([
      userHasRole(actorUserId, "operator"),
      userHasRole(actorUserId, "admin"),
    ]);
    if (!isOperator && !isAdmin) throw err("FORBIDDEN_NOT_OPERATOR", 403);

    const listing = await listingsDal.getById(listingId);
    if (!listing) throw err("LISTING_NOT_FOUND", 404);
    if (listing.status !== "awarded") throw err("LISTING_NOT_AWARDED", 409);

    const offerId = listing.acceptedOfferId;
    if (!offerId) throw err("LISTING_HAS_NO_AWARD", 409);

    const shipment = await listingsDal.getShipmentByOfferId(offerId);
    if (!shipment) {
      // An awarded listing always has one, but a half-written award would not,
      // and refusing to un-award it would leave the job stuck for good.
      await reboard(listing);
      return { listingId, offerId, shipmentId: null };
    }

    await this.withdrawFromJob(
      shipment.id,
      { category: "support_resolution", reason },
      { userId: actorUserId, isAdmin, isOperator }
    );

    return { listingId, offerId, shipmentId: shipment.id };
  },

  /**
   * The Expedion client calls their own transport off.
   *
   * Authorised through `getQuote`, which answers **404** to a non-owner — that
   * is deliberate on that inlet and must be preserved here, or this route
   * becomes a quote-id oracle standing next to routes that are not.
   *
   * Three shapes of quote reach this: one still waiting for a driver with no
   * listing at all, one on the board with no award yet, and one with a live
   * shipment. Only the third has money and a transporter attached to it.
   */
  async cancelForQuote(
    quoteId: string,
    caller: ExpedionCallerIdentity,
    input: CancelJobInput
  ) {
    const quote = await expedionService.getQuote(quoteId, caller);

    // `getQuote` waves an admin through for any quote, so the caller is only
    // the client when they own it. An operator acting here is an operator.
    const onBehalf = Boolean(caller.isAdmin) && quote.firebaseUid !== caller.userId;
    const side: CancellationSide = onBehalf ? "operator" : "requester";
    assertCategory(side, input.category);

    const shipment = quote.listingId
      ? await shipmentsDal.getByListingId(quote.listingId)
      : undefined;

    if (shipment && shipment.status !== "CANCELLED") {
      const result = await this.cancelJob(shipment.id, input, {
        kind: onBehalf ? "operatorForQuote" : "quoteOwner",
        ref: onBehalf ? caller.userId : quote.firebaseUid,
      });
      // A projection, never the row. This inlet's rule throughout: the raw
      // shipment carries the winning driver's bid — which is what the platform
      // pays out, not what this client paid Expedion, so the difference is the
      // margin — plus both street addresses, the internal party ids and the
      // audit columns.
      return {
        quoteId,
        shipmentId: shipment.id,
        cancelled: true,
        alreadyCancelled: result.alreadyCancelled,
      };
    }

    if (quote.listingId) {
      const listing = await listingsDal.getById(quote.listingId);
      if (listing && listing.status !== "cancelled") await closeListing(listing);
    }

    await expedionBridgeService.onQuoteCancelled({
      quoteId,
      side,
      reason: input.reason ?? null,
    });

    return { quoteId, shipmentId: null, cancelled: true, alreadyCancelled: false };
  },
};

// ========================================
// Shared steps
// ========================================

async function loadJob(shipmentId: string) {
  const ownership = await shipmentsDal.getOwnership(shipmentId);
  if (!ownership) throw err("SHIPMENT_NOT_FOUND", 404);

  const listing = await listingsDal.getById(ownership.listingId);
  if (!listing) throw err("LISTING_NOT_FOUND", 404);

  return { ownership, listing };
}

/**
 * Everything a cancellation has to settle once the shipment row is off: the
 * listing and its offers, and the write-back that is the *only* record an
 * Expedion operator has that a refund is owed over there.
 *
 * Split out so a retry can run it again. It is idempotent — `closeListing`
 * writes the same three fields, and the bridge returns early on a quote that is
 * already cancelled.
 */
async function settleCancelledJob(
  listing: Listing,
  side: CancellationSide,
  reason: string | null
) {
  await closeListing(listing);

  // Awaited on the escalated lane, not fire-and-forget. On a direct job the
  // write-back is courtesy; here it carries `refundIssued: false` and the
  // Stripe handle, and it is the whole reason the client's real money — taken
  // in Expedion's account, which `refundForJob` refuses to touch — ever gets
  // given back. Losing it to a swallowed rejection loses the refund claim.
  if (listing.origin === "expedion") {
    await expedionBridgeService.onJobCancelled({
      listingId: listing.id,
      side,
      reason,
    });
    return;
  }

  notifyExpedion(
    expedionBridgeService.onJobCancelled({ listingId: listing.id, side, reason })
  );
}

/**
 * A repeat finishes the work instead of answering "already done".
 *
 * A cancellation is four writes across four tables and is not one transaction.
 * Absorbing the repeat — which is right, and stops a second refund going out
 * under a 409 — used to mean a run that flipped to `CANCELLED` and then failed
 * on the listing or the bridge could never be completed: `cancelJob`,
 * `withdrawFromJob` and `revokeAward` all land back here. So the repeat re-runs
 * the settlement, and only skips the money and the row.
 */
async function finishCancel(
  ownership: JobOwnership,
  listing: Listing,
  side: CancellationSide,
  reason?: string
) {
  if (isCurrentRun(listing, ownership) || listing.status === "awarded") {
    await settleCancelledJob(listing, side, reason ?? null);
  }

  return {
    shipment: await shipmentsDal.getById(ownership.id),
    listingId: listing.id,
    alreadyCancelled: true as const,
  };
}

/** The withdraw half of the same repair. */
async function finishWithdraw(ownership: JobOwnership, listing: Listing) {
  if (isCurrentRun(listing, ownership)) {
    await reboard(listing);
    notifyExpedion(
      expedionBridgeService.onAwardWithdrawn({ listingId: listing.id })
    );
  }

  return {
    shipment: await shipmentsDal.getById(ownership.id),
    listingId: listing.id,
    alreadyCancelled: true as const,
  };
}

function assertCancellable(side: CancellationSide, status: string) {
  if (canCancelAs(side, status)) return;
  if (requiresSupport(side, status)) throw err("CANCEL_REQUIRES_SUPPORT", 409);
  throw err("INVALID_STATUS_TRANSITION", 409);
}

/**
 * Is this shipment the run the listing is actually holding?
 *
 * A listing can now carry more than one — and could already: a declined charge
 * sends `compensateFailedAward` to re-open the job while leaving the shipment
 * `commitAward` created alive and `PENDING`. Stopping *that* row would refund
 * the money taken for a **different** carrier's award, un-award their offer and
 * put an open listing under a driver who is still driving it.
 *
 * The listing row is not the authority on which offer to un-award; the shipment
 * being stopped is.
 */
function isCurrentRun(listing: Listing, ownership: JobOwnership): boolean {
  return listing.acceptedOfferId === ownership.offerId;
}

function assertCurrentRun(listing: Listing, ownership: JobOwnership) {
  if (!isCurrentRun(listing, ownership)) {
    throw err("SHIPMENT_NOT_CURRENT", 409);
  }
}

/** Back on the board, with the bids this award had knocked out. */
async function reboard(listing: Listing): Promise<string[]> {
  const offerId = listing.acceptedOfferId;
  if (!offerId) return [];

  const rejectedIds = await rejectedRivalIds(listing.id);
  await offersService.reopenForRebid(listing.id, offerId, rejectedIds, {
    winnerStatus: "withdrawn",
    markReopened: true,
  });

  const rivals = await offersDal.listByListing(listing.id);
  return rivals
    .filter((offer) => rejectedIds.includes(offer.id))
    .map((offer) => offer.carrierId);
}
