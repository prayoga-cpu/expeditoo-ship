import { describe, expect, it } from "vitest";

import type { Job } from "@/features/app/listing/types";
import { splitAwardQueue } from "../AwardQueue";

/** client_feedback_2026_10_21_spec.md §B1 */
const job = (id: string, origin: Job["origin"], offersCount: number, pickupFrom: string) =>
  ({ id, origin, offersCount, pickupFrom }) as unknown as Job;

describe("splitAwardQueue", () => {
  it("puts escalated jobs with a bid in « À attribuer »", () => {
    const { toAward, waiting } = splitAwardQueue(
      [job("e1", "expedion", 2, "2026-11-01T08:00:00Z")],
      []
    );

    expect(toAward.map((j) => j.id)).toEqual(["e1"]);
    expect(waiting).toEqual([]);
  });

  it("puts everything else in « En attente d'un chauffeur », soonest pickup first", () => {
    const { toAward, waiting } = splitAwardQueue(
      [job("e0", "expedion", 0, "2026-11-05T08:00:00Z")],
      [
        job("d1", "direct", 3, "2026-11-03T08:00:00Z"),
        job("d2", "direct", 0, "2026-11-01T08:00:00Z"),
      ]
    );

    expect(toAward).toEqual([]);
    // A direct request with bids is still the requester's to award.
    expect(waiting.map((j) => j.id)).toEqual(["d2", "d1", "e0"]);
  });
});
