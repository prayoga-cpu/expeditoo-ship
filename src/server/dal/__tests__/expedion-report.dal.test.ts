import { describe, it, expect } from "vitest";
import { toReportRowSets } from "@/server/dal/expedion-report.dal";

/**
 * `getReportRowSets` returns the six lists as JSON columns of one row, so the
 * split from that row into the six arrays is the only part of it that can be
 * exercised without a database — and it is the part that turns a wrong shape
 * into a crash on the operator's screen.
 *
 * The empty cases are not hypothetical. `json_agg` over no rows returns SQL
 * NULL rather than `[]`, and two of the four queues are empty on real data, so
 * the `coalesce(..., '[]'::json)` in the query and the guard here are both
 * load-bearing.
 */

const QUOTE = {
  id: "q1",
  reference: "EX-2481",
  status: "paid",
  payment_status: "paid",
  auction_house_name: "Drouot",
  delivery_city: "Bordeaux",
  client_name: "A. Client",
  price_cents: "19600",
  standard_cents: "18000",
  insured_cents: "21000",
  owned: true,
  has_pickup_coords: true,
  escalation_ready: true,
  storage_free_until: "2026-08-22T10:23:45.123456",
  escalate_after: "2026-08-20 08:00:00",
  requested_at: "2026-08-18T12:11:49",
};

const EMPTY_KEYS = [
  "statuses",
  "series",
  "queue_to_price",
  "queue_needs_driver",
  "queue_storage_at_risk",
  "queue_escalation_due",
  "recent",
] as const;

describe("toReportRowSets", () => {
  it("gives every set an array when the row is empty", () => {
    const r = toReportRowSets({});
    expect(r.statuses).toEqual([]);
    expect(r.series).toEqual([]);
    expect(r.recent).toEqual([]);
    expect(r.queues.toPrice).toEqual([]);
    expect(r.queues.needsDriver).toEqual([]);
    expect(r.queues.storageAtRisk).toEqual([]);
    expect(r.queues.escalationDue).toEqual([]);
  });

  it.each(EMPTY_KEYS)("turns a null %s into an array, not a crash", (key) => {
    const row = Object.fromEntries(EMPTY_KEYS.map((k) => [k, null]));
    const r = toReportRowSets({ ...row, [key]: null });
    const all = [
      r.statuses,
      r.series,
      r.recent,
      r.queues.toPrice,
      r.queues.needsDriver,
      r.queues.storageAtRisk,
      r.queues.escalationDue,
    ];
    expect(all.every(Array.isArray)).toBe(true);
  });

  it("maps each queue off its own column", () => {
    const r = toReportRowSets({
      queue_to_price: [{ ...QUOTE, id: "a" }],
      queue_needs_driver: [{ ...QUOTE, id: "b" }],
      queue_storage_at_risk: [{ ...QUOTE, id: "c" }],
      queue_escalation_due: [{ ...QUOTE, id: "d" }],
      recent: [{ ...QUOTE, id: "e" }],
    });
    expect(r.queues.toPrice.map((q) => q.id)).toEqual(["a"]);
    expect(r.queues.needsDriver.map((q) => q.id)).toEqual(["b"]);
    expect(r.queues.storageAtRisk.map((q) => q.id)).toEqual(["c"]);
    expect(r.queues.escalationDue.map((q) => q.id)).toEqual(["d"]);
    expect(r.recent.map((q) => q.id)).toEqual(["e"]);
  });

  it("revives the three date columns into Dates", () => {
    const [row] = toReportRowSets({ recent: [QUOTE] }).recent;
    expect(row.requestedAt).toBeInstanceOf(Date);
    expect(row.storageFreeUntil).toBeInstanceOf(Date);
    expect(row.escalateAfter).toBeInstanceOf(Date);
    // Both shapes Postgres emits through json_agg, space- and T-separated,
    // have to land on the same instant.
    expect(row.escalateAfter?.getTime()).toBe(
      new Date("2026-08-20T08:00:00").getTime()
    );
  });

  it("keeps a null date null rather than epoch zero", () => {
    const [row] = toReportRowSets({
      recent: [
        { ...QUOTE, storage_free_until: null, escalate_after: null },
      ],
    }).recent;
    expect(row.storageFreeUntil).toBeNull();
    expect(row.escalateAfter).toBeNull();
  });

  it("numbers the money columns that arrive as strings", () => {
    const [row] = toReportRowSets({ recent: [QUOTE] }).recent;
    expect(row.priceCents).toBe(19600);
    expect(row.standardCents).toBe(18000);
    expect(row.insuredCents).toBe(21000);
  });

  it("counts statuses and series through Number", () => {
    const r = toReportRowSets({
      statuses: [{ status: "paid", count: "12" }],
      series: [{ bucket: "2026-08", quotes: 3, accepted: "29986373" }],
    });
    expect(r.statuses).toEqual([{ status: "paid", count: 12 }]);
    expect(r.series).toEqual([
      { name: "2026-08", quotes: 3, acceptedCents: 29986373 },
    ]);
  });
});
