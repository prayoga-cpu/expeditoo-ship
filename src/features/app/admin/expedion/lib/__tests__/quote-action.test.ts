import { describe, expect, it } from "vitest";

import type { QuoteRow } from "@/server/dal/expedion-report.dal";

import {
  byUrgency,
  isNewQuote,
  nextAction,
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

  it("still offers escalation when the row is blocked, but marks it", () => {
    const action = nextAction(row({
        status: "paid",
        paymentStatus: "paid",
        escalationReady: false,
        queues: { ...NO_QUEUES, escalationDue: true },
      }));

    expect(action.kind).toBe("escalate");
    expect(action.blocked).toBe(true);
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

  it("flags storage as work with no dialog behind it", () => {
    const action = nextAction(row({
        status: "paid",
        paymentStatus: "paid",
        queues: { ...NO_QUEUES, storageAtRisk: true },
        storageFreeUntil: new Date("2026-08-21T12:00:00.000Z"),
      }));

    expect(action.kind).toBe("storage");
    expect(action.actionable).toBe(true);
    expect(action.dialog).toBeNull();
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

describe("byUrgency", () => {
  it("orders by kind, then oldest first inside a kind", () => {
    const escalation = row({
      id: "escalate",
      status: "paid",
      queues: { ...NO_QUEUES, escalationDue: true },
    });
    const oldPrice = row({
      id: "old-price",
      status: "pending",
      queues: { ...NO_QUEUES, toPrice: true },
      requestedAt: new Date("2026-08-01T12:00:00Z"),
    });
    const newPrice = row({
      id: "new-price",
      status: "pending",
      queues: { ...NO_QUEUES, toPrice: true },
      requestedAt: new Date("2026-08-18T12:00:00Z"),
    });

    expect(
      [newPrice, escalation, oldPrice].sort(byUrgency()).map((r) => r.id)
    ).toEqual(["escalate", "old-price", "new-price"]);
  });
});
