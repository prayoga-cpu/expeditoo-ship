import { describe, expect, it } from "vitest";

import type { QuoteRow } from "@/server/dal/expedion-report.dal";
import type { ExpedionReport } from "@/server/services/expedion-report.service";

import { __testing } from "../useExpedionReport";

/**
 * `QuoteRow`'s date fields survive the trip through JSON.
 *
 * The bug this pins was invisible to every other test: the DAL builds real
 * `Date`s, the component test hands the component real `Date`s, and `unwrap` is
 * a cast — so the only place the truth differed was a running browser, where
 * `NextResponse.json` had already turned them into strings and the Storage
 * queue threw `date.getTime is not a function` on its first row.
 *
 * Serialising here, rather than asserting against hand-written strings, is the
 * point: a date column added to `QuoteRow` but not to `reviveQuoteDates` fails
 * this test instead of reaching production.
 */

const { reviveQuoteDates } = __testing;

function row(overrides: Partial<QuoteRow> = {}): QuoteRow {
  return {
    id: "q1",
    reference: "EXP-1",
    status: "paid",
    paymentStatus: "paid",
    auctionHouseName: "Drouot",
    deliveryCity: "Lyon",
    clientName: "A. Client",
    clientEmail: "client@example.com",
    priceCents: 1000,
    standardCents: 1000,
    insuredCents: 1200,
    owned: true,
    hasPickupCoords: true,
    queues: {
      toPrice: false,
      needsDriver: false,
      storageAtRisk: true,
      escalationDue: false,
    },
    storageFreeUntil: new Date("2026-08-20T00:00:00.000Z"),
    escalateAfter: new Date("2026-08-18T00:00:00.000Z"),
    requestedAt: new Date("2026-08-14T00:00:00.000Z"),
    ...overrides,
  };
}

function report(rows: QuoteRow[]): ExpedionReport {
  return {
    queues: {
      toPrice: [],
      needsDriver: [],
      storageAtRisk: rows,
      escalationDue: [],
    },
    recent: rows,
  } as unknown as ExpedionReport;
}

/** Exactly what the route does to the payload on its way out. */
function overTheWire<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe("reviveQuoteDates", () => {
  it("restores Dates that JSON turned into strings", () => {
    const revived = reviveQuoteDates(overTheWire(report([row()])));
    const [quote] = revived.queues.storageAtRisk;

    for (const field of [
      quote.storageFreeUntil,
      quote.escalateAfter,
      quote.requestedAt,
    ]) {
      expect(field).toBeInstanceOf(Date);
    }
    expect(quote.storageFreeUntil?.toISOString()).toBe(
      "2026-08-20T00:00:00.000Z"
    );
  });

  it("gives the storage column something it can call getTime on", () => {
    const revived = reviveQuoteDates(overTheWire(report([row()])));
    const { storageFreeUntil } = revived.queues.storageAtRisk[0];

    // This is the exact call QuoteQueueTable.daysUntil makes, and the exact
    // call that used to throw.
    expect(() => storageFreeUntil!.getTime()).not.toThrow();
  });

  it("revives every queue and the recent list, not just one", () => {
    const wire = overTheWire(report([row()]));
    wire.queues.toPrice = wire.queues.storageAtRisk;
    const revived = reviveQuoteDates(wire);

    expect(revived.queues.toPrice[0].requestedAt).toBeInstanceOf(Date);
    expect(revived.recent[0].requestedAt).toBeInstanceOf(Date);
  });

  it("keeps nulls null and refuses an unparseable date", () => {
    const revived = reviveQuoteDates(
      overTheWire(
        report([row({ storageFreeUntil: null })])
      )
    );
    expect(revived.queues.storageAtRisk[0].storageFreeUntil).toBeNull();

    // A malformed string must not become an Invalid Date, which renders as
    // "NaN" rather than as the em-dash the table shows for "no date".
    const broken = report([row()]);
    broken.queues.storageAtRisk[0] = {
      ...broken.queues.storageAtRisk[0],
      storageFreeUntil: "not-a-date" as unknown as Date,
    };
    expect(reviveQuoteDates(broken).queues.storageAtRisk[0].storageFreeUntil)
      .toBeNull();
  });

  it("is idempotent, so a real Date passes through untouched", () => {
    const once = reviveQuoteDates(report([row()]));
    const twice = reviveQuoteDates(once);
    expect(twice.queues.storageAtRisk[0].storageFreeUntil?.toISOString()).toBe(
      "2026-08-20T00:00:00.000Z"
    );
  });
});
