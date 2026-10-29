import { describe, expect, it } from "vitest";

import { decodePolyline } from "../polyline";

/** client_feedback_2026_10_29_spec.md §N8 — the route's line. */
describe("decodePolyline", () => {
  it("decodes Google's reference line at precision 5", () => {
    const points = decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@", 5);
    expect(points).toEqual([
      [-120.2, 38.5],
      [-120.95, 40.7],
      [-126.453, 43.252],
    ]);
  });

  it("reads nothing as no points", () => {
    expect(decodePolyline("")).toEqual([]);
  });
});
