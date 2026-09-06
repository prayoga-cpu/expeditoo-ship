/**
 * ============================================================================
 * Who may stop a transport, how, and why
 * ============================================================================
 *
 * There are two verbs and they are not symmetrical.
 *
 *   **Cancel**   — the job is off. The requester no longer needs the transport,
 *                  or an operator has ended it. The listing dies with it.
 *   **Withdraw** — *this transporter* is off; the job survives. The client still
 *                  wants the delivery and has already paid for it, so the job
 *                  goes back on the board and somebody else takes it.
 *
 * Until this module existed the repo held four disagreeing answers to "can this
 * be cancelled": the service's own guard, a dead `canCancelShipment` helper in
 * `shipment.dto.ts`, a `CANCELLABLE` array in a browser hook, and the driver
 * surface's silence. The service is still the authority — this is only what it
 * and the hooks both consult, so they can no longer differ.
 *
 * The vocabulary is named here rather than in the schema, the way
 * `TIME_SLOTS`/`timeSlotEnum` already are: `src/db/schema/shipments.ts` derives
 * its two pgEnums from these tuples (CLAUDE.md gotcha 8), and a browser bundle
 * that needs the labels does not have to pull in drizzle to get them.
 *
 * See docs/specs/cancellations_spec.md §3, §5.
 */

// ========================================
// Vocabulary
// ========================================

/**
 * Which side ended the run.
 *
 * A carrier and its employed driver are one commercial side. The poster and the
 * accountless Expedion quote owner are another. An operator is a third.
 */
export const CANCELLATION_SIDES = [
  "requester",
  "transporter",
  "operator",
] as const;

export type CancellationSide = (typeof CANCELLATION_SIDES)[number];

/**
 * Why. One flat list, fenced per side by `CATEGORIES_BY_SIDE` below rather than
 * split into three columns, so a report can group on it with no join.
 */
export const CANCELLATION_CATEGORIES = [
  "vehicle_breakdown",
  "driver_unavailable",
  "cargo_mismatch",
  "access_impossible",
  "no_longer_needed",
  "date_changed",
  "arranged_elsewhere",
  "no_driver_found",
  "fraud_or_abuse",
  "support_resolution",
  "other",
] as const;

export type CancellationCategory = (typeof CANCELLATION_CATEGORIES)[number];

/**
 * The fence. `other` is on every side deliberately — a taxonomy with no escape
 * hatch teaches people to pick the nearest wrong value.
 *
 * `cargo_mismatch` and `access_impossible` sit on the transporter's side even
 * though the *cause* is usually the client's description or the pickup site.
 * That is the point: they are named separately so a future reliability count
 * can decline to charge them to the driver.
 */
export const CATEGORIES_BY_SIDE: Record<
  CancellationSide,
  readonly CancellationCategory[]
> = {
  transporter: [
    "vehicle_breakdown",
    "driver_unavailable",
    "cargo_mismatch",
    "access_impossible",
    "other",
  ],
  requester: [
    "no_longer_needed",
    "date_changed",
    "arranged_elsewhere",
    "other",
  ],
  operator: [
    "no_driver_found",
    "fraud_or_abuse",
    "support_resolution",
    "other",
  ],
};

export function categoriesForSide(
  side: CancellationSide
): readonly CancellationCategory[] {
  return CATEGORIES_BY_SIDE[side];
}

export function isCategoryForSide(
  side: CancellationSide,
  category: CancellationCategory
): boolean {
  return CATEGORIES_BY_SIDE[side].includes(category);
}

// ========================================
// Who is asking
// ========================================

/** The parties `partyFor` can resolve, minus the one that may do nothing. */
export type CancellationParty = "shipper" | "carrier" | "driver" | "staff";

export type ListingOriginForPolicy = "direct" | "expedion";

/**
 * The party says what the viewer is to this shipment; the side says what they
 * are commercially. The inlet is what separates them.
 *
 * On an escalated job `listings.shipper_id` is the Expedion system account that
 * nobody signs into, so `shipper` there is never the requester — the real
 * requester is the quote owner, who has no `user` row and reaches the app
 * through the quote route instead. Anyone holding that seat is acting as an
 * operator, and §5.4 of the spec then requires them to actually hold the role.
 */
export function sideFor(
  party: CancellationParty,
  origin: ListingOriginForPolicy
): CancellationSide {
  if (party === "staff") return "operator";
  if (party === "carrier" || party === "driver") return "transporter";
  return origin === "expedion" ? "operator" : "requester";
}

// ========================================
// What each side may do, and when
// ========================================

/** Before pickup nothing has changed hands, so either side may act alone. */
export const SELF_SERVICE_STATUSES = ["PENDING", "ASSIGNED"] as const;

/**
 * Past this point the goods are in a vehicle and only an operator may end the
 * run. `DELIVERED` is absent from both lists and stays that way: a payout row
 * and an invoice already exist and there is no clawback anywhere.
 */
export const OPERATOR_ONLY_STATUSES = ["PICKED_UP", "IN_TRANSIT"] as const;

const isSelfService = (status: string): boolean =>
  (SELF_SERVICE_STATUSES as readonly string[]).includes(status);

const isOperatorOnly = (status: string): boolean =>
  (OPERATOR_ONLY_STATUSES as readonly string[]).includes(status);

/**
 * May this side end the job outright?
 *
 * A transporter never may — ending a client's paid job is not theirs to do, and
 * the service answers `USE_WITHDRAW_ENDPOINT` rather than a flat refusal so the
 * message names the verb that works.
 */
export function canCancelAs(side: CancellationSide, status: string): boolean {
  if (side === "transporter") return false;
  if (side === "operator") return isSelfService(status) || isOperatorOnly(status);
  return isSelfService(status);
}

/**
 * May this side hand the job back to the board?
 *
 * Not the requester: handing your own job back to the board is just cancelling
 * it, and the service says so by name rather than refusing flatly.
 *
 * Never after pickup, for anyone: offering a job to the board while its cargo
 * sits in somebody else's van is a lie. Past that point an operator ends the
 * run outright, and the goods are a support matter.
 *
 * The *driver* refusal is not here, because a driver and their carrier share
 * the `transporter` side. It is a party check in the service: the award belongs
 * to the carrier and an employed driver must not be able to destroy it. A solo
 * driver is their own carrier — `carriers` is person-level — so it never
 * reaches them.
 */
export function canWithdrawAs(side: CancellationSide, status: string): boolean {
  if (side === "requester") return false;
  return isSelfService(status);
}

/**
 * True when the answer is "not by yourself, but support can" — which is what
 * the client-facing copy has always promised and what the state machine has
 * never actually allowed.
 */
export function requiresSupport(
  side: CancellationSide,
  status: string
): boolean {
  return side !== "operator" && isOperatorOnly(status);
}
