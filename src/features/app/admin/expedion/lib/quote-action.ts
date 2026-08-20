import type { QuoteRow } from "@/server/dal/expedion-report.dal";

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
export type QuoteDialog = "reprice" | "assign" | "escalate";

export interface QuoteAction {
  kind: QuoteActionKind;
  /** Whether an operator has something to do on this row right now. */
  actionable: boolean;
  dialog: QuoteDialog | null;
  /**
   * Set on `escalate` when `escalationBlockers` would refuse the row. The
   * button stays visible and disabled: the work is real, it is the data that
   * has to be fixed first, and hiding it is how a job sat unescalated.
   */
  blocked?: boolean;
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
    return {
      kind: "escalate",
      actionable: true,
      dialog: "escalate",
      blocked: !(quote.escalationReady ?? quote.hasPickupCoords),
    };
  }
  if (queues.needsDriver) {
    return { kind: "assign", actionable: true, dialog: "assign" };
  }
  if (queues.toPrice) {
    return { kind: "price", actionable: true, dialog: "reprice" };
  }
  // Storage is a deadline nobody can clear from this table — the lot has to be
  // collected — so it is actionable only in the sense that it needs chasing,
  // and it never carries a dialog.
  if (queues.storageAtRisk) {
    return { kind: "storage", actionable: true, dialog: null };
  }

  if (quote.status === "accepted" && quote.paymentStatus !== "paid") {
    return { kind: "awaitingPayment", actionable: false, dialog: null };
  }
  if (["assigned", "escalated", "picked_up"].includes(quote.status)) {
    return { kind: "inProgress", actionable: false, dialog: null };
  }
  return { kind: "awaitingClient", actionable: false, dialog: null };
}

/** Sort weight, most urgent first; ties fall through to age. */
const RANK: Record<QuoteActionKind, number> = {
  escalate: 0,
  assign: 1,
  price: 2,
  storage: 3,
  awaitingPayment: 4,
  awaitingClient: 5,
  inProgress: 6,
  done: 7,
  cancelled: 8,
};

/**
 * Work order: most urgent kind first, then whichever has been waiting longest.
 *
 * Oldest-first inside a kind is the opposite of the newest-first the recent
 * feed uses, and deliberately so — the quote that has sat the longest is the
 * one about to cost something.
 */
export function byUrgency() {
  return (a: QuoteRow, b: QuoteRow): number => {
    const rank = RANK[nextAction(a).kind] - RANK[nextAction(b).kind];
    if (rank !== 0) return rank;
    const at = a.requestedAt?.getTime() ?? Number.POSITIVE_INFINITY;
    const bt = b.requestedAt?.getTime() ?? Number.POSITIVE_INFINITY;
    return at - bt;
  };
}
