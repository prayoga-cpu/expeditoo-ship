import { describe, expect, it } from "vitest";

import { listingStatusEnum } from "@/db/schema/listings";
import {
  CONVERSATION_BUCKETS,
  CONVERSATION_FILTERS,
  LISTING_STATUS_BUCKET,
  conversationBucket,
  isConversationFilter,
  toConversationCounts,
} from "../conversation-filter";

/** client feedback 2026-11-19, #26 */
describe("conversation filter", () => {
  it("places every listing status, and nothing that is not one", () => {
    expect(Object.keys(LISTING_STATUS_BUCKET).sort()).toEqual(
      [...listingStatusEnum.enumValues].sort()
    );
  });

  it("uses every job bucket, and never « none » for a job", () => {
    const used = new Set(Object.values(LISTING_STATUS_BUCKET));
    expect([...used].sort()).toEqual(
      CONVERSATION_BUCKETS.filter((b) => b !== "none").sort()
    );
  });

  it("reads the state the way the chips name it", () => {
    expect(conversationBucket("open")).toBe("waiting");
    expect(conversationBucket("scheduled")).toBe("waiting");
    expect(conversationBucket("draft")).toBe("waiting");
    expect(conversationBucket("awarded")).toBe("active");
    expect(conversationBucket("in_progress")).toBe("active");
    expect(conversationBucket("completed")).toBe("done");
    expect(conversationBucket("cancelled")).toBe("done");
    expect(conversationBucket("expired")).toBe("done");
  });

  it("puts a conversation about no job in « none »", () => {
    expect(conversationBucket(null)).toBe("none");
    expect(conversationBucket(undefined)).toBe("none");
  });

  it("accepts only its own filter names", () => {
    for (const filter of CONVERSATION_FILTERS) {
      expect(isConversationFilter(filter)).toBe(true);
    }
    expect(isConversationFilter("unread")).toBe(false);
    expect(isConversationFilter("")).toBe(false);
    expect(isConversationFilter(null)).toBe(false);
  });

  it("folds the grouped rows into counts whose sum is « all »", () => {
    const counts = toConversationCounts([
      { status: "open", count: 3 },
      { status: "scheduled", count: 1 },
      { status: "in_progress", count: 2 },
      { status: "completed", count: 4 },
      { status: "expired", count: 1 },
      { status: null, count: 5 },
    ]);

    expect(counts).toEqual({ all: 16, waiting: 4, active: 2, done: 5, none: 5 });
  });

  it("counts nothing as zero everywhere, and reads a driver's string count", () => {
    expect(toConversationCounts([])).toEqual({
      all: 0,
      waiting: 0,
      active: 0,
      done: 0,
      none: 0,
    });
    expect(
      toConversationCounts([{ status: "open", count: "2" as unknown as number }]).waiting
    ).toBe(2);
  });
});
