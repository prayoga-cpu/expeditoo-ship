import { describe, expect, it } from "vitest";

import type { QuoteRow } from "@/server/dal/expedion-report.dal";

import {
  canRepriceQuote,
  escalationHoursLeft,
  isNewQuote,
  nextAction,
  quoteCapabilities,
  storageDaysLeft,
} from "../quote-action";

/**
 * The recent list's badge and its button both come from `nextAction`, so what
 * is pinned here is that they agree and that the priority order holds: a row
 * past its escalation deadline must not be offered "assign a driver" merely
 * because it is also in the no-driver queue, which it always is.
 */

const NOW = new Date("2026-08-19T12:00:00.000Z");

const NO_QUEUES = {
  toPrice: false,
  needsDriver: false,
  storageAtRisk: false,
  escalationDue: false,
};

function row(overrides: Partial<QuoteRow> = {}): QuoteRow {
  return {
    id: "q1",
    reference: "EX-1",
    status: "quoted",
    paymentStatus: "unpaid",
    auctionHouseName: "Drouot",
    deliveryCity: "Lyon",
    clientName: "A. Client",
    clientEmail: "client@example.com",
    priceCents: 12_000,
    standardCents: 12_000,
    insuredCents: 14_000,
    owned: true,
    hasPickupCoords: true,
    escalationReady: true,
    escalationBlockers: [],
    queues: { ...NO_QUEUES },
    storageFreeUntil: null,
    escalateAfter: null,
    requestedAt: new Date("2026-08-10T12:00:00.000Z"),
    ...overrides,
  };
}

describe("nextAction", () => {
  it("puts an overdue escalation above the no-driver queue it is also in", () => {
    const action = nextAction(row({
        status: "paid",
        paymentStatus: "paid",
        queues: { ...NO_QUEUES, needsDriver: true, escalationDue: true },
      }));

    expect(action.kind).toBe("escalate");
    expect(action.dialog).toBe("escalate");
    expect(action.actionable).toBe(true);
    expect(action.blocked).toBe(false);
  });

  it("still offers escalation when the row is blocked, but marks it and names why", () => {
    const action = nextAction(row({
        status: "paid",
        paymentStatus: "paid",
        escalationReady: false,
        escalationBlockers: ["pickupCoords", "weight"],
        queues: { ...NO_QUEUES, escalationDue: true },
      }));

    expect(action.kind).toBe("escalate");
    expect(action.blocked).toBe(true);
    expect(action.blockers).toEqual(["pickupCoords", "weight"]);
  });

  it("carries no blocker list once the row is ready", () => {
    const action = nextAction(row({
        status: "paid",
        paymentStatus: "paid",
        queues: { ...NO_QUEUES, escalationDue: true },
      }));

    expect(action.blocked).toBe(false);
    expect(action.blockers).toBeUndefined();
  });

  it("falls back to the pickup-coordinate flag when readiness is absent", () => {
    const quote = row({
      status: "paid",
      paymentStatus: "paid",
      hasPickupCoords: false,
      queues: { ...NO_QUEUES, escalationDue: true },
    });
    delete quote.escalationReady;

    expect(nextAction(quote).blocked).toBe(true);
  });

  it("asks for a driver on a paid job with none", () => {
    const action = nextAction(row({
        status: "paid",
        paymentStatus: "paid",
        queues: { ...NO_QUEUES, needsDriver: true },
      }));

    expect(action.kind).toBe("assign");
    expect(action.dialog).toBe("assign");
  });

  it("asks for a price on an unpriced request", () => {
    const action = nextAction(row({ status: "pending", queues: { ...NO_QUEUES, toPrice: true } }));

    expect(action.kind).toBe("price");
    expect(action.dialog).toBe("reprice");
  });

  it("flags storage as work, with a dialog that can adjust its terms", () => {
    const action = nextAction(row({
        status: "paid",
        paymentStatus: "paid",
        queues: { ...NO_QUEUES, storageAtRisk: true },
        storageFreeUntil: new Date("2026-08-21T12:00:00.000Z"),
      }));

    expect(action.kind).toBe("storage");
    expect(action.actionable).toBe(true);
    expect(action.dialog).toBe("storage");
  });

  it("does not invent work for the client's half of the flow", () => {
    expect(nextAction(row({ status: "quoted" }))).toMatchObject({
      kind: "awaitingClient",
      actionable: false,
      dialog: null,
    });

    expect(
      nextAction(row({ status: "accepted", paymentStatus: "unpaid" }))
    ).toMatchObject({ kind: "awaitingPayment", actionable: false });

    expect(
      nextAction(row({ status: "picked_up", paymentStatus: "paid" }))
    ).toMatchObject({ kind: "inProgress", actionable: false });
  });

  it("keeps finished quotes out of the work, whatever queue flags say", () => {
    // A cancelled row can still satisfy `storageAtRisk`: the predicate excludes
    // cancelled, but the flag travels with rows the report already fetched.
    expect(
      nextAction(row({
          status: "cancelled",
          queues: { ...NO_QUEUES, storageAtRisk: true },
        }))
    ).toMatchObject({ kind: "cancelled", actionable: false });

    expect(nextAction(row({ status: "delivered" }))).toMatchObject({
      kind: "done",
      actionable: false,
    });
  });
});

describe("isNewQuote", () => {
  it("counts the last 24 hours, and nothing dated in the future", () => {
    expect(
      isNewQuote(row({ requestedAt: new Date("2026-08-19T09:00:00Z") }), NOW)
    ).toBe(true);
    expect(
      isNewQuote(row({ requestedAt: new Date("2026-08-18T09:00:00Z") }), NOW)
    ).toBe(false);
    expect(
      isNewQuote(row({ requestedAt: new Date("2026-08-20T09:00:00Z") }), NOW)
    ).toBe(false);
    expect(isNewQuote(row({ requestedAt: null }), NOW)).toBe(false);
  });
});

describe("storageDaysLeft", () => {
  it("counts whole days and goes negative once billing starts", () => {
    expect(
      storageDaysLeft(
        row({ storageFreeUntil: new Date("2026-08-22T12:00:00Z") }),
        NOW
      )
    ).toBe(3);
    expect(
      storageDaysLeft(
        row({ storageFreeUntil: new Date("2026-08-18T12:00:00Z") }),
        NOW
      )
    ).toBe(-1);
    expect(storageDaysLeft(row(), NOW)).toBeNull();
  });
});

describe("escalationHoursLeft", () => {
  it("counts whole hours and stops at the deadline", () => {
    expect(
      escalationHoursLeft(
        row({ escalateAfter: new Date("2026-08-21T12:00:00Z") }),
        NOW
      )
    ).toBe(48);
    expect(
      escalationHoursLeft(
        row({ escalateAfter: new Date("2026-08-19T13:30:00Z") }),
        NOW
      )
    ).toBe(2);
    // Past the deadline the row is `escalate`, not `assign` — a countdown
    // under a badge saying the time is up reads as a contradiction.
    expect(
      escalationHoursLeft(
        row({ escalateAfter: new Date("2026-08-19T11:00:00Z") }),
        NOW
      )
    ).toBeNull();
    expect(escalationHoursLeft(row(), NOW)).toBeNull();
  });
});

/** Paid, nobody carrying it — the state the fork exists for. */
const paidRow = (overrides: Partial<QuoteRow> = {}) =>
  row({
    status: "paid",
    paymentStatus: "paid",
    queues: { ...NO_QUEUES, needsDriver: true },
    ...overrides,
  });

describe("nextAction — the post-payment fork", () => {
  it("offers both lanes on a paid row, assignment first", () => {
    const action = nextAction(paidRow());

    expect(action.kind).toBe("assign");
    expect(action.dialogs).toEqual(["assign", "escalate"]);
    // `dialog` stays the emphasised one, for callers that only want the first.
    expect(action.dialog).toBe("assign");
    expect(action.actionable).toBe(true);
  });

  // `assignDirect` runs through `escalate`, so the same ten checks gate both
  // lanes. A row that fails them can take neither, and offering "Assign" (a
  // guaranteed 422) beside a "Publish" that silently opens a fix form is how
  // an operator ends up clicking twice to learn one thing.
  it("collapses to a single Fix when neither lane is open", () => {
    const action = nextAction(
      paidRow({
        escalationReady: false,
        escalationBlockers: ["deliveryPostalCode", "weight"],
      })
    );

    expect(action.kind).toBe("assign");
    expect(action.dialogs).toEqual(["escalate"]);
    expect(action.blocked).toBe(true);
    expect(action.blockers).toEqual(["deliveryPostalCode", "weight"]);
  });

  it("offers both lanes again once the blockers are cleared", () => {
    expect(
      nextAction(paidRow({ escalationReady: true, escalationBlockers: [] }))
        .dialogs
    ).toEqual(["assign", "escalate"]);
  });

  it("collapses to publishing alone once the deadline has passed", () => {
    const action = nextAction(
      paidRow({ queues: { ...NO_QUEUES, needsDriver: true, escalationDue: true } })
    );

    expect(action.kind).toBe("escalate");
    expect(action.dialogs).toEqual(["escalate"]);
  });

  it("offers nothing on a step that is not an operator's to take", () => {
    for (const quote of [
      row({ status: "accepted" }),
      row({ status: "assigned" }),
      row({ status: "delivered" }),
      row({ status: "cancelled" }),
    ]) {
      expect(nextAction(quote).dialogs).toEqual([]);
    }
  });
});

describe("quoteCapabilities", () => {
  // The mirror of `PRICE_LOCKED` in `expedion.service.ts`. If these two drift,
  // the dashboard offers a form the API can only refuse.
  it("closes repricing the moment the money lands", () => {
    expect(quoteCapabilities(row({ status: "quoted" })).canReprice).toBe(true);
    expect(
      quoteCapabilities(row({ status: "accepted", paymentStatus: "unpaid" }))
        .canReprice
    ).toBe(true);
    expect(quoteCapabilities(paidRow()).canReprice).toBe(false);
  });

  // Keyed on `paymentStatus`, not `status`, which is what lets a refunded
  // quote be priced again — the whole basis of cancel-and-re-quote.
  it("reopens repricing once a payment is unwound", () => {
    expect(
      canRepriceQuote({ status: "quoted", paymentStatus: "unpaid" })
    ).toBe(true);
    expect(canRepriceQuote({ status: "paid", paymentStatus: "paid" })).toBe(
      false
    );
  });

  it("opens dispatch and re-quote only while the fork is open", () => {
    const open = quoteCapabilities(paidRow());
    expect(open).toMatchObject({
      canAssign: true,
      canEscalate: true,
      canRequote: true,
    });

    // `needsDriver` already means "paid, no carrier, no listing, still live",
    // so a job that has left the fork leaves all three behind with it.
    const dispatched = quoteCapabilities(
      row({ status: "escalated", paymentStatus: "paid" })
    );
    expect(dispatched).toMatchObject({
      canAssign: false,
      canEscalate: false,
      canRequote: false,
    });
  });

  // The queue predicate is `payment_status = 'paid' AND status = 'paid'`, but
  // this asserts the status half independently: it is the guard standing
  // between an operator and `cancelAndRequote`, which unwinds a payment. 1085
  // imported rows sit at `picked_up` with a settled payment and no carrier.
  it("offers nothing dispatchable on a job already in transit", () => {
    const inTransit = row({
      status: "picked_up",
      paymentStatus: "paid",
      queues: { ...NO_QUEUES, needsDriver: true },
    });

    expect(quoteCapabilities(inTransit)).toMatchObject({
      canAssign: false,
      canEscalate: false,
      canRequote: false,
    });
  });

  it("shuts everything on a finished quote", () => {
    for (const status of ["delivered", "cancelled"]) {
      expect(quoteCapabilities(row({ status }))).toEqual({
        canReprice: false,
        canAssign: false,
        canEscalate: false,
        canEditStorage: false,
        canRequote: false,
      });
    }
  });

  // Storage terms are not a price. A lot whose auction house agreed to hold it
  // longer has to be recordable at any live status, paid or not.
  it("keeps storage terms editable after payment", () => {
    expect(quoteCapabilities(paidRow()).canEditStorage).toBe(true);
    expect(
      quoteCapabilities(row({ status: "picked_up", paymentStatus: "paid" }))
        .canEditStorage
    ).toBe(true);
  });
});
