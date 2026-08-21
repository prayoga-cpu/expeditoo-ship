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

/** Which dialog the row's primary button opens, when there is one. */
export type QuoteDialog = "reprice" | "assign" | "escalate" | "storage";

export interface QuoteAction {
  kind: QuoteActionKind;
  /** Whether an operator has something to do on this row right now. */
  actionable: boolean;
  dialog: QuoteDialog | null;
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
  if (quote.status === "cancelled") {
    return { kind: "cancelled", actionable: false, dialog: null };
  }
  if (quote.status === "delivered") {
    return { kind: "done", actionable: false, dialog: null };
  }

  const queues = quote.queues;

  if (queues.escalationDue) {
    const blocked = !(quote.escalationReady ?? quote.hasPickupCoords);
    return {
      kind: "escalate",
      actionable: true,
      dialog: "escalate",
      blocked,
      blockers: blocked ? quote.escalationBlockers : undefined,
    };
  }
  if (queues.needsDriver) {
    return { kind: "assign", actionable: true, dialog: "assign" };
  }
  if (queues.toPrice) {
    return { kind: "price", actionable: true, dialog: "reprice" };
  }
  // The lot itself still has to be collected — no dialog clears that — but
  // the terms around it (the free-storage deadline, the fee after) are
  // editable, for a lot whose auction house agreed to hold it longer.
  if (queues.storageAtRisk) {
    return { kind: "storage", actionable: true, dialog: "storage" };
  }

  if (quote.status === "accepted" && quote.paymentStatus !== "paid") {
    return { kind: "awaitingPayment", actionable: false, dialog: null };
  }
  if (["assigned", "escalated", "picked_up"].includes(quote.status)) {
    return { kind: "inProgress", actionable: false, dialog: null };
  }
  return { kind: "awaitingClient", actionable: false, dialog: null };
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
