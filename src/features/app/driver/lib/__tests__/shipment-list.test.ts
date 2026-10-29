import { describe, expect, it } from "vitest";

import { deliveryDate, inWindow, listDate, pickupDate, sortShipments } from "../shipment-list";

/** client_feedback_2026_10_29_spec.md §N2 */
const run = (over: Record<string, string | null> = {}) => ({
  id: "r",
  scheduledPickup: null,
  scheduledDelivery: null,
  pickedUpAt: null,
  deliveredAt: null,
  createdAt: "2026-10-01T09:00:00.000Z",
  ...over,
});

describe("the dates a run is read by", () => {
  it("prefers what happened to what was planned", () => {
    const done = run({
      scheduledPickup: "2026-10-10T08:00:00.000Z",
      pickedUpAt: "2026-10-10T09:30:00.000Z",
      scheduledDelivery: "2026-10-12T20:00:00.000Z",
      deliveredAt: "2026-10-11T16:00:00.000Z",
    });
    expect(pickupDate(done)).toBe("2026-10-10T09:30:00.000Z");
    expect(deliveryDate(done)).toBe("2026-10-11T16:00:00.000Z");
    expect(listDate(done)).toBe("2026-10-11T16:00:00.000Z");
  });

  it("falls back to the pickup, then the booking day", () => {
    expect(listDate(run({ scheduledPickup: "2026-10-10T08:00:00.000Z" }))).toBe("2026-10-10T08:00:00.000Z");
    expect(listDate(run())).toBe("2026-10-01T09:00:00.000Z");
  });
});

describe("sortShipments", () => {
  const a = { ...run({ scheduledDelivery: "2026-10-05T10:00:00.000Z" }), id: "a" };
  const b = { ...run({ scheduledDelivery: "2026-10-20T10:00:00.000Z" }), id: "b" };
  const c = { ...run({ deliveredAt: "2026-10-12T10:00:00.000Z" }), id: "c" };

  it("orders by delivery date either way round", () => {
    expect(sortShipments([b, a, c], "asc").map((s) => s.id)).toEqual(["a", "c", "b"]);
    expect(sortShipments([b, a, c], "desc").map((s) => s.id)).toEqual(["b", "c", "a"]);
  });

  it("does not reorder the list it was given", () => {
    const list = [b, a];
    sortShipments(list, "asc");
    expect(list.map((s) => s.id)).toEqual(["b", "a"]);
  });
});

describe("inWindow", () => {
  const s = run({ scheduledDelivery: new Date(2026, 9, 12, 15).toISOString() });

  it("keeps everything when no window is picked", () => {
    expect(inWindow(s, "", "")).toBe(true);
  });

  it("includes both ends of the window", () => {
    expect(inWindow(s, "2026-10-12", "2026-10-12")).toBe(true);
    expect(inWindow(s, "2026-10-01", "2026-10-11")).toBe(false);
    expect(inWindow(s, "2026-10-13", "")).toBe(false);
    expect(inWindow(s, "", "2026-10-12")).toBe(true);
  });
});
