import { nanoid } from "nanoid";
import { shipmentsDal } from "@/server/dal/shipments.dal";
import { expedionDal } from "@/server/dal/expedion.dal";
import { emailService } from "@/server/services/email.service";
import {
  expedionService,
  type ExpedionCallerIdentity,
} from "@/server/services/expedion.service";
import type { ExpedionCaller } from "@/lib/expedion-auth";
import { partyFor, type Viewer } from "@/server/services/shipment-access";
import {
  confirmationUrl,
  verifyConfirmationToken,
  type ConfirmableMilestone,
  CONFIRMABLE_MILESTONES,
} from "@/lib/confirmation-token";
import type {
  ShipmentStatusType,
  ShipmentConfirmationChannel,
  ShipmentConfirmationActor,
} from "@/db/schema/shipments";

/**
 * ============================================================================
 * Client confirmations
 * ============================================================================
 *
 * The transporter moves the status; the client attests that the milestone
 * really happened (transport_status_confirmation_spec.md).
 *
 * **An attestation grants nothing.** Nothing in this file writes
 * `shipments.status`, a `shipment_events` row, a payment or a listing status,
 * and nothing here may start doing so - the public one-tap link in
 * `confirmation-token.ts` is only safe to mail because of it.
 *
 * Kept out of `shipment.service.ts` so that file can call in without a cycle:
 * this module reaches for DALs only.
 */

export class ConfirmationError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message?: string
  ) {
    super(message ?? code);
    this.name = "ConfirmationError";
  }
}

const err = (code: string, status: number, message?: string) =>
  new ConfirmationError(code, status, message);

/**
 * Which shipment states put a milestone in the past.
 *
 * `PICKED_UP` stays attestable once the run has moved on, because the client is
 * asked at the moment of pickup and may well answer a day later.
 */
const REACHED_IN: Record<ConfirmableMilestone, ShipmentStatusType[]> = {
  PICKED_UP: ["PICKED_UP", "IN_TRANSIT", "DELIVERED"],
  DELIVERED: ["DELIVERED"],
};

export function isConfirmableMilestone(
  value: string
): value is ConfirmableMilestone {
  return (CONFIRMABLE_MILESTONES as readonly string[]).includes(value);
}

/**
 * What a confirmation looks like over the wire.
 *
 * `confirmedByUserId`, `confirmedByRef` and `note` stay server-side. They are
 * the audit trail, and nothing that reads a write response needs them - but
 * one of the two write routes is unauthenticated, so a row returned whole
 * would hand a bearer-token holder the quote owner's id and another client's
 * note. Projecting in the service rather than in each route means the two
 * cannot drift apart (transport_status_confirmation_spec.md §7.3).
 */
export interface ConfirmationView {
  id: string;
  milestone: ConfirmableMilestone;
  channel: ShipmentConfirmationChannel;
  confirmedByRole: ShipmentConfirmationActor;
  createdAt: Date;
}

function toView(row: {
  id: string;
  milestone: ShipmentStatusType;
  channel: ShipmentConfirmationChannel;
  confirmedByRole: ShipmentConfirmationActor;
  createdAt: Date;
}): ConfirmationView {
  return {
    id: row.id,
    milestone: row.milestone as ConfirmableMilestone,
    channel: row.channel,
    confirmedByRole: row.confirmedByRole,
    createdAt: row.createdAt,
  };
}

export interface AttestInput {
  shipmentId: string;
  milestone: ConfirmableMilestone;
  channel: ShipmentConfirmationChannel;
  /** Defaults to `client`; `operator` when staff answered on their behalf. */
  confirmedByRole?: ShipmentConfirmationActor;
  confirmedByUserId?: string | null;
  confirmedByRef?: string | null;
  note?: string;
}

export const shipmentConfirmationsService = {
  /**
   * Record the attestation. **This method authorises nobody.**
   *
   * Read on before calling it from anywhere new: it trusts every field it is
   * handed, `confirmedByUserId` and `confirmedByRole` included, and it never
   * asks who the caller is. That was invisible while its only two callers had
   * already decided the question - `attestForQuote` through
   * `expedionService.getQuote`, `attestFromToken` through the signed token -
   * but exposing it over HTTP as it stands would let any signed-in user attest
   * to a stranger's delivery, and name themselves an operator while doing it.
   *
   * So every entry point above it authorises first and derives the two
   * identity fields itself; `attestInApp` is the third of them. Nothing may
   * reach this method straight from a route.
   */
  async attest(input: AttestInput) {
    const ownership = await shipmentsDal.getOwnership(input.shipmentId);
    if (!ownership) throw err("SHIPMENT_NOT_FOUND", 404);

    if (ownership.status === "CANCELLED") {
      throw err(
        "SHIPMENT_CANCELLED",
        409,
        "This transport was cancelled and has nothing left to confirm"
      );
    }

    if (!REACHED_IN[input.milestone].includes(ownership.status)) {
      throw err(
        "MILESTONE_NOT_REACHED",
        409,
        `The transport has not reached ${input.milestone} yet`
      );
    }

    const created = await shipmentsDal.createConfirmation({
      id: nanoid(),
      shipmentId: input.shipmentId,
      milestone: input.milestone,
      channel: input.channel,
      confirmedByRole: input.confirmedByRole ?? "client",
      confirmedByUserId: input.confirmedByUserId ?? null,
      confirmedByRef: input.confirmedByRef ?? null,
      note: input.note ?? null,
    });

    // The unique index absorbed a repeat: a second tap is the same answer, not
    // an error to show someone who has already done what we asked.
    if (!created) {
      const existing = await shipmentsDal.getConfirmation(
        input.shipmentId,
        input.milestone
      );
      if (existing) {
        return { confirmation: toView(existing), alreadyConfirmed: true };
      }
      throw err("CONFIRMATION_FAILED", 500);
    }

    void mirrorToExpedion(
      ownership.listingId,
      input.milestone,
      input.confirmedByRole ?? "client"
    ).catch((error) => {
      console.error("[confirmations] Expedion mirror failed", error);
    });

    return { confirmation: toView(created), alreadyConfirmed: false };
  },

  /**
   * The signed-in client's entry point, from the delivery screen they are
   * already looking at.
   *
   * The third channel, and the only one whose caller carries a session, so it
   * is the only one that can be authorised by asking what the caller *is* to
   * this shipment. `partyFor` is the same resolution `shipment.service.ts`
   * uses, so a run one screen refuses to show cannot be attested from another.
   *
   * Who may answer:
   * - `shipper` - the requester, the person the attestation is asked of.
   * - `staff` - an operator answering for a client who cannot, recorded as
   *   `operator` so no surface reads it as the client's own answer.
   * - `carrier` / `driver` - refused. The transporter moves the status; a
   *   record where they also sign for it is worth nothing in a dispute.
   * - anyone else - refused, as `getShipmentDetail` already refuses them.
   *
   * Both identity fields come off the session, never off the body: the DTO
   * accepts a milestone and a note and nothing else, so there is no field a
   * caller could set to attest as somebody else.
   */
  async attestInApp(
    shipmentId: string,
    viewer: Viewer,
    input: { milestone: ConfirmableMilestone; note?: string }
  ) {
    const ownership = await shipmentsDal.getOwnership(shipmentId);
    if (!ownership) throw err("SHIPMENT_NOT_FOUND", 404);

    const party = partyFor(ownership, viewer);

    if (party === "none") {
      throw err("FORBIDDEN", 403, "This transport is not yours to confirm");
    }

    if (party === "carrier" || party === "driver") {
      throw err(
        "TRANSPORTER_CANNOT_ATTEST",
        403,
        "The transporter moves the status; the client attests it"
      );
    }

    return await this.attest({
      shipmentId,
      milestone: input.milestone,
      channel: "app",
      confirmedByRole: party === "staff" ? "operator" : "client",
      // A session proves a `user` row, so the foreign key is the record and
      // there is no external owner id to keep beside it — unlike the Expedion
      // lanes, where the client usually has no account at all.
      confirmedByUserId: viewer.userId,
      confirmedByRef: null,
      note: input.note,
    });
  },

  /**
   * The Expedion app's entry point, addressed by quote id — the only
   * identifier the Flutter client holds.
   *
   * Authorisation is `expedionService.getQuote`, which is where quote
   * ownership is already decided: routes resolve the session and pass it down,
   * services enforce (docs/rules.md §1.4, CLAUDE.md "Services enforce
   * permissions"). It answers 404 rather than 403 for a non-owner, so nobody
   * learns which quote ids exist.
   */
  async attestForQuote(
    quoteId: string,
    caller: ExpedionCallerIdentity & Pick<ExpedionCaller, "via">,
    input: { milestone: ConfirmableMilestone; note?: string }
  ) {
    const quote = await expedionService.getQuote(quoteId, caller);

    if (!quote.listingId) {
      throw err(
        "SHIPMENT_NOT_FOUND",
        404,
        "This quote has not been escalated to a transport yet"
      );
    }

    const shipment = await shipmentsDal.getByListingId(quote.listingId);
    if (!shipment) {
      throw err(
        "SHIPMENT_NOT_FOUND",
        404,
        "No driver has been awarded this transport yet"
      );
    }

    // An admin may answer for a client who cannot, but the row says so: every
    // surface reads this to avoid reporting an answer the client never gave.
    const onBehalf = caller.isAdmin && quote.firebaseUid !== caller.userId;

    return await this.attest({
      shipmentId: shipment.id,
      milestone: input.milestone,
      channel: "expedion_app",
      confirmedByRole: onBehalf ? "operator" : "client",
      // Only a Better Auth session proves a `user` row exists. On the Firebase
      // and shared-key paths `caller.userId` is an owner id with nothing behind
      // it, and the foreign key would reject the insert.
      confirmedByUserId: caller.via === "session" ? caller.userId : null,
      confirmedByRef: caller.userId,
      note: input.note,
    });
  },

  /** The one-tap link. Anyone holding the token; the token grants only this. */
  async attestFromToken(token: string, note?: string) {
    const claims = verifyConfirmationToken(token);
    if (!claims) throw err("INVALID_TOKEN", 410, "This link is no longer valid");

    const ownership = await shipmentsDal.getOwnership(claims.shipmentId);
    if (!ownership) throw err("SHIPMENT_NOT_FOUND", 404);

    const quote = await expedionDal.getByListingId(ownership.listingId);

    return await this.attest({
      shipmentId: claims.shipmentId,
      milestone: claims.milestone,
      channel: "link",
      // On an escalated job the client is the quote owner and has no `user`
      // row; on a direct one the link was mailed to the shipper, who does.
      confirmedByUserId: quote ? null : ownership.shipperId,
      confirmedByRef: quote?.firebaseUid ?? ownership.shipperId,
      note,
    });
  },

  /**
   * What the public landing page renders.
   *
   * A deliberately thin projection. The page is reachable by anyone holding
   * the link, so it says what is being confirmed and where the goods are going
   * - never the price, the parties, or anything else `shipment.service.ts`
   * withholds from a driver.
   */
  async describeToken(token: string) {
    const claims = verifyConfirmationToken(token);
    if (!claims) throw err("INVALID_TOKEN", 410, "This link is no longer valid");

    const shipment = await shipmentsDal.getById(claims.shipmentId);
    if (!shipment) throw err("SHIPMENT_NOT_FOUND", 404);

    const existing = await shipmentsDal.getConfirmation(
      claims.shipmentId,
      claims.milestone
    );

    return {
      milestone: claims.milestone,
      shipmentStatus: shipment.status,
      // Cities, never the street addresses the shipment also holds. This page
      // is reachable by anyone holding a link that lives for 30 days in an
      // SMS, and the dropoff on an Expedion job is the client's home address.
      // Absent rather than falling back to the full address if the listing is
      // somehow missing - a fallback here would reinstate exactly the leak.
      pickupCity: shipment.listing?.pickupCity ?? null,
      dropoffCity: shipment.listing?.dropoffCity ?? null,
      reference: shipment.listing?.title ?? null,
      alreadyConfirmed: Boolean(existing),
      confirmedAt: existing?.createdAt ?? null,
      /**
       * False when the driver has not got there yet - the page says so rather
       * than offering a button that would 409. `cancelled` is reported
       * separately because the two need opposite copy: one promises a further
       * message, and the other must not.
       */
      confirmable:
        shipment.status !== "CANCELLED" &&
        REACHED_IN[claims.milestone].includes(shipment.status),
      cancelled: shipment.status === "CANCELLED",
    };
  },

  async listFor(shipmentId: string) {
    return await shipmentsDal.getConfirmations(shipmentId);
  },

  /**
   * Email the client the one-tap link for a milestone the transporter has just
   * recorded.
   *
   * The SMS half is not sent from here: the bridge already texts on exactly
   * these two transitions, and it appends the same link to that message rather
   * than firing a second one (§8). Two texts about one event is how a client
   * learns to ignore both.
   *
   * Returns quietly when there is no address or no signing secret. A
   * confirmation request that could not be sent must never fail the delivery
   * that triggered it.
   */
  async requestConfirmation(
    shipmentId: string,
    milestone: ConfirmableMilestone
  ): Promise<void> {
    const url = confirmationUrl(shipmentId, milestone);
    if (!url) return;

    const shipment = await shipmentsDal.getById(shipmentId);
    if (!shipment) return;

    const quote = await expedionDal.getByListingId(shipment.listingId);

    // On an escalated job the client is the quote owner, and `shipment.shipper`
    // is the Expedion system account that nobody logs into — falling back to it
    // would mail an internal mailbox a working one-tap token and still leave
    // the real client unasked. So the shipper is used only when there is no
    // quote at all, which is exactly a direct listing someone posted here.
    const to = quote ? quote.email : (shipment.shipper?.email ?? null);
    if (!to) return;

    await emailService.sendConfirmationRequestEmail(to, {
      recipientName: quote?.firstName ?? shipment.shipper?.name ?? null,
      milestone,
      confirmUrl: url,
      reference: quote?.bordereauNumber ?? shipment.listing?.title ?? null,
      dropoffAddress: shipment.dropoffAddress,
    });
  },
};

/**
 * Puts the client's answer on the Expedion quote timeline, so an operator
 * reading the quote sees it without opening Expeditoo.
 *
 * Writes an event and **not** a status: the quote's lifecycle is driven by the
 * transporter's side of the bridge, and a confirmation is not a stage.
 * No-op for a listing with no quote behind it.
 */
async function mirrorToExpedion(
  listingId: string,
  milestone: ConfirmableMilestone,
  role: ShipmentConfirmationActor
): Promise<void> {
  const quote = await expedionDal.getByListingId(listingId);
  if (!quote) return;

  // Never "le client a confirmé" for an answer an operator gave on their
  // behalf. Saying so would defeat the point of asking.
  const who = role === "operator" ? "Un opérateur" : "Le client";
  const what =
    milestone === "PICKED_UP"
      ? "le retrait"
      : "la bonne réception";
  const suffix = role === "operator" ? " pour le compte du client" : "";

  await expedionDal.addEvent({
    id: nanoid(),
    quoteId: quote.id,
    status: quote.status,
    actor: role === "operator" ? "admin" : "client",
    message: `${who} a confirmé ${what}${suffix}`,
    metadata: { listingId, confirmedMilestone: milestone, confirmedBy: role },
  });
}
