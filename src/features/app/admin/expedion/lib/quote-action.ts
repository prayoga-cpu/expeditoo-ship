import type {
  EscalationBlockerCode,
  QuoteRow,
} from "@/server/dal/expedion-report.dal";

/**
 * What a quote is waiting for, and who it is waiting on.
 *
 * The recent list is the first thing on the operator report, so it has to
 * answer "is there anything for me here?" without the operator reading four
 * queue tabs and cross-referencing. That answer is derived here rather than in
 * the component because it decides both the badge and the button, and the two
 * disagreeing — a row labelled "to price" whose button assigns a driver — is
 * the failure worth a unit test.
 *
 * The queue membership comes from the server (`QuoteRow.queues`), so this is a
 * priority order over facts, never a second definition of them. Re-deriving
 * `needsDriver` from `status` alone would be that second definition: it turns
 * on a null carrier *and* a null listing, and neither is on the wire.
 */

export type QuoteActionKind =
  /** Past its escalation deadline — publish to the marketplace now. */
  | "escalate"
  /** Paid, no driver, deadline not reached yet. */
  | "assign"
  /** Received with no published price. */
  | "price"
  /** Nothing to do but the free-storage window closes within four days. */
  | "storage"
  /** Client accepted, money not reported yet. */
  | "awaitingPayment"
  /** Priced or quoted; the ball is with the client. */
  | "awaitingClient"
  /** A driver has it. */
  | "inProgress"
  | "done"
  | "cancelled";

/**
 * Which dialog a row's button — or its overflow entry — opens.
 *
 * `requote` is never a row's *next step*, so it never appears in
 * `QuoteAction.dialogs`; it is a correction, offered only through the overflow
 * and only while `canRequote` holds.
 */
export type QuoteDialog =
  | "reprice"
  | "assign"
  | "escalate"
  | "storage"
  | "requote";

export interface QuoteAction {
  kind: QuoteActionKind;
  /** Whether an operator has something to do on this row right now. */
  actionable: boolean;
  dialog: QuoteDialog | null;
  /**
   * Every dialog this step offers, most-recommended first — `dialog` is just
   * `dialogs[0]`.
   *
   * Only `assign` has more than one. Payment is a fork, not a queue: the
   * operator either hands the job to a driver in the pool or puts it out to
   * bid, and both are the right answer depending on the job. Offering one and
   * hiding the other behind an overflow menu made the timer look like the
   * decision-maker, which it is not — it is the fallback for an operator who
   * did not choose.
   */
  dialogs: QuoteDialog[];
  /**
   * Set on `escalate` when `escalationBlockers` would refuse the row. The
   * button stays visible and enabled: it opens a fix-and-publish dialog
   * rather than the plain publish confirmation, because the work is real —
   * it is the data that has to be fixed first, and hiding it is how a job
   * sat unescalated.
   */
  blocked?: boolean;
  /** Which checks are failing, when `blocked` is true. */
  blockers?: EscalationBlockerCode[];
}

/** A quote requested within this window is still "new" to the operator. */
const NEW_WINDOW_MS = 24 * 60 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

export function isNewQuote(quote: QuoteRow, now: Date = new Date()): boolean {
  if (!quote.requestedAt) return false;
  const age = now.getTime() - quote.requestedAt.getTime();
  return age >= 0 && age < NEW_WINDOW_MS;
}

/** Whole days until free storage ends; negative once it is being billed. */
export function storageDaysLeft(
  quote: QuoteRow,
  now: Date = new Date()
): number | null {
  if (!quote.storageFreeUntil) return null;
  return Math.ceil((quote.storageFreeUntil.getTime() - now.getTime()) / DAY_MS);
}

const HOUR_MS = 60 * 60 * 1000;

/**
 * Whole hours until the escalation timer publishes this quote itself; null
 * once the deadline is gone or was never set.
 *
 * Displayed next to a `needsDriver` row so the operator can see that the
 * decision has a clock on it without having to know the window is 48 hours.
 * Client-side against the panel's single `now`, exactly like
 * `storageDaysLeft` — which of the two states a row is *in* is still the
 * server's answer (`queues.escalationDue`); this only renders the gap.
 */
export function escalationHoursLeft(
  quote: QuoteRow,
  now: Date = new Date()
): number | null {
  if (!quote.escalateAfter) return null;
  const hours = Math.ceil((quote.escalateAfter.getTime() - now.getTime()) / HOUR_MS);
  return hours > 0 ? hours : null;
}

/**
 * The single thing this quote is waiting for, most urgent first.
 *
 * No clock: every deadline was evaluated server-side against one `now()` when
 * the report was built, and re-evaluating here against the browser's clock
 * would let a badge and the queue it came from disagree about the same row.
 *
 * Order is deliberate: escalation is the only step with a deadline that has
 * already passed, so it outranks a job that merely has no driver yet, which in
 * turn outranks pricing — nobody is charged for a quote that is a day late,
 * and a lot in storage is.
 */
export function nextAction(quote: QuoteRow): QuoteAction {
  if (quote.status === "cancelled") return idle("cancelled");
  if (quote.status === "delivered") return idle("done");

  const queues = quote.queues;

  if (queues.escalationDue) {
    const blocked = !(quote.escalationReady ?? quote.hasPickupCoords);
    return {
      kind: "escalate",
      actionable: true,
      dialog: "escalate",
      dialogs: ["escalate"],
      blocked,
      blockers: blocked ? quote.escalationBlockers : undefined,
    };
  }
  // The fork. Both branches are legitimate outcomes of the same fact — the
  // client has paid and nobody is carrying the job yet — so both are offered,
  // with assignment first because it is the cheaper of the two when the pool
  // can cover the run.
  if (queues.needsDriver) {
    // Unless the row cannot take either of them. `assignDirect` runs through
    // `escalate`, so the same ten `escalationBlockers` gate both lanes: a row
    // missing a delivery postal code answers Assign with a 422 and Publish
    // with a dialog that cannot publish. Offering two lanes neither of which
    // is open is worse than naming the one thing that is — fix the data, and
    // the fork comes back on the next render.
    const blocked = !(quote.escalationReady ?? quote.hasPickupCoords);
    if (blocked) {
      return {
        kind: "assign",
        actionable: true,
        dialog: "escalate",
        dialogs: ["escalate"],
        blocked: true,
        blockers: quote.escalationBlockers,
      };
    }
    return {
      kind: "assign",
      actionable: true,
      dialog: "assign",
      dialogs: ["assign", "escalate"],
    };
  }
  if (queues.toPrice) {
    return {
      kind: "price",
      actionable: true,
      dialog: "reprice",
      dialogs: ["reprice"],
    };
  }
  // The lot itself still has to be collected — no dialog clears that — but
  // the terms around it (the free-storage deadline, the fee after) are
  // editable, for a lot whose auction house agreed to hold it longer.
  if (queues.storageAtRisk) {
    return {
      kind: "storage",
      actionable: true,
      dialog: "storage",
      dialogs: ["storage"],
    };
  }

  if (quote.status === "accepted" && quote.paymentStatus !== "paid") {
    return idle("awaitingPayment");
  }
  if (["assigned", "escalated", "picked_up"].includes(quote.status)) {
    return idle("inProgress");
  }
  return idle("awaitingClient");
}

/** A step nobody can act on: no button, no dialog. */
function idle(kind: QuoteActionKind): QuoteAction {
  return { kind, actionable: false, dialog: null, dialogs: [] };
}

/**
 * What an operator is *allowed* to do to this quote, as opposed to what it is
 * waiting for.
 *
 * `nextAction` answers "what is the one next step here"; this answers "which
 * of the four dialogs may open at all". They are separate questions: a paid
 * quote's next step is to get a driver, but its storage terms are still
 * editable and its price is not.
 *
 * This is a mirror of the server's rules — `PRICE_FIELDS` and the
 * `PRICE_LOCKED` check in `expedion.service.ts`, and the preconditions on
 * `assignDirect` — never a second definition of them. The server has the final
 * word; this exists so an operator is not offered a button that can only 409.
 */
export interface QuoteCapabilities {
  /** Publish or change a price. */
  canReprice: boolean;
  /** Hand the job to a driver in the pool. */
  canAssign: boolean;
  /** Publish the job to the Expeditoo marketplace. */
  canEscalate: boolean;
  /** Edit the free-storage deadline and the daily fee after it. */
  canEditStorage: boolean;
  /** Refund and return the quote to the client for a new price. */
  canRequote: boolean;
}

/** A quote in one of these is finished; nothing is editable. */
const TERMINAL = ["delivered", "cancelled"];

/**
 * Whether a price may still be published or changed.
 *
 * Takes the two fields it reads rather than a `QuoteRow`, because the detail
 * dialog holds a full `ExpedionQuote` and the report holds a row projection —
 * and "is this price still editable" must not have one answer per surface.
 *
 * The mirror of `PRICE_LOCKED` in `expedion.service.ts`, down to keying on
 * `paymentStatus` rather than `status`: a refunded quote becomes editable
 * again, which is what `cancelAndRequote` depends on.
 */
export function canRepriceQuote(quote: {
  status: string;
  paymentStatus: string;
}): boolean {
  return !TERMINAL.includes(quote.status) && quote.paymentStatus !== "paid";
}

export function quoteCapabilities(quote: QuoteRow): QuoteCapabilities {
  const live = !TERMINAL.includes(quote.status);

  // `needsDriver` is "paid, status paid, no carrier, no listing, still live" —
  // exactly the window in which a quote can be dispatched or unwound. Taking
  // it from the queue rather than re-deriving it keeps the button and the
  // badge answering to the same fact; `assignedCarrierId` and `listingId` are
  // not on the wire for this row, so re-deriving would be a looser copy.
  //
  // `status === 'paid'` is asserted again anyway. The queue predicate now
  // carries it, but this is the guard standing between an operator and
  // `cancelAndRequote`, which unwinds a payment — and the cost of the two
  // drifting apart is a job in transit rewound to `quoted`. Cheap belt to a
  // brace that has already slipped once.
  const dispatchable = quote.queues.needsDriver && quote.status === "paid";

  return {
    canReprice: canRepriceQuote(quote),
    canAssign: dispatchable,
    canEscalate: dispatchable,
    canEditStorage: live,
    canRequote: dispatchable,
  };
}

/**
 * Whatever a draft (a quote, or the in-progress edit form over one) carries
 * for the ten `escalationBlockers` checks — no more, since that is all this
 * needs to answer "what is still missing".
 */
export interface EscalationDraft {
  pickupLat?: number | null;
  pickupLng?: number | null;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  pickupAddress?: string | null;
  pickupCity?: string | null;
  pickupPostalCode?: string | null;
  deliveryAddress?: string | null;
  deliveryCity?: string | null;
  deliveryPostalCode?: string | null;
  weightKg?: number | null;
  acceptedPriceCents?: number | null;
}

function hasPostalCode(value: string | null | undefined): boolean {
  return !!value && /^\d{5}$/.test(value.replace(/\D/g, ""));
}

/**
 * Client-side mirror of `escalationBlockers`
 * (`expedion-escalation.service.ts`), run against a draft still being edited
 * so a fix form's checklist updates as the operator types instead of waiting
 * on a round trip. Kept to the same ten checks in the same order; the server
 * still has the final word the moment Publish is actually clicked.
 */
export function draftEscalationBlockers(
  draft: EscalationDraft
): EscalationBlockerCode[] {
  const blockers: EscalationBlockerCode[] = [];
  if (draft.pickupLat == null || draft.pickupLng == null)
    blockers.push("pickupCoords");
  if (draft.deliveryLat == null || draft.deliveryLng == null)
    blockers.push("deliveryCoords");
  if (!draft.pickupAddress) blockers.push("pickupAddress");
  if (!draft.pickupCity) blockers.push("pickupCity");
  if (!hasPostalCode(draft.pickupPostalCode)) blockers.push("pickupPostalCode");
  if (!draft.deliveryAddress) blockers.push("deliveryAddress");
  if (!draft.deliveryCity) blockers.push("deliveryCity");
  if (!hasPostalCode(draft.deliveryPostalCode))
    blockers.push("deliveryPostalCode");
  if (!draft.weightKg || draft.weightKg <= 0) blockers.push("weight");
  if (!draft.acceptedPriceCents || draft.acceptedPriceCents < 100)
    blockers.push("acceptedPrice");
  return blockers;
}
