import { describe, expect, it } from "vitest";

import type { QuoteRow } from "@/server/dal/expedion-report.dal";
import { worklist } from "../RecentQuotesPanel";

/**
 * « À traiter » is every queued quote of any age, each once, oldest request
 * first (client_feedback_2026_10_21_spec.md §A1–A2).
 */
const NO_QUEUES = {
  toPrice: false,
  needsDriver: false,
  storageAtRisk: false,
  escalationDue: false,
};

function row(id: string, requestedAt: string, overrides: Partial<QuoteRow> = {}): QuoteRow {
  return {
    id,
    quoteRef: 1,
    reference: null,
    status: "pending",
    paymentStatus: "unpaid",
    auctionHouseName: "Drouot",
    deliveryCity: "Lyon",
    clientName: null,
    clientEmail: null,
    priceCents: null,
    standardCents: null,
    insuredCents: null,
    owned: true,
    hasPickupCoords: true,
    escalationReady: true,
    escalationBlockers: [],
    queues: { ...NO_QUEUES, toPrice: true },
    storageFreeUntil: null,
    escalateAfter: null,
    requestedAt: new Date(requestedAt),
    ...overrides,
  };
}

describe("worklist", () => {
  it("orders the work oldest request first", () => {
    const list = worklist([
      row("new", "2026-10-20T00:00:00.000Z"),
      row("old", "2026-09-01T00:00:00.000Z"),
      row("mid", "2026-10-01T00:00:00.000Z"),
    ]);

    expect(list.map((r) => r.id)).toEqual(["old", "mid", "new"]);
  });

  it("lists a quote in two queues once", () => {
    const paidLate = row("late", "2026-09-20T00:00:00.000Z", {
      status: "paid",
      paymentStatus: "paid",
      queues: { ...NO_QUEUES, needsDriver: true, escalationDue: true },
    });

    expect(worklist([paidLate, paidLate])).toHaveLength(1);
  });

  it("drops a row with nothing for an operator to do", () => {
    const delivered = row("done", "2026-09-20T00:00:00.000Z", {
      status: "delivered",
      paymentStatus: "paid",
      queues: { ...NO_QUEUES },
    });

    expect(worklist([delivered])).toEqual([]);
  });
});
