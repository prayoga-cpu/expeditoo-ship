import { describe, it, expect } from "vitest";
import { activeRequests, featuredRequest } from "../myRequestStatus";
import type { Job, ListingStatus } from "@/features/app/listing/types";

const job = (
  id: string,
  status: ListingStatus,
  createdAt = "2026-01-01T00:00:00.000Z"
) => ({ id, status, createdAt }) as unknown as Job;

describe("featuredRequest", () => {
  it("picks the most recently created among open/awarded/in_progress", () => {
    const featured = featuredRequest([
      job("older", "open", "2026-01-01T00:00:00.000Z"),
      job("newer", "awarded", "2026-01-05T00:00:00.000Z"),
    ]);

    expect(featured?.id).toBe("newer");
  });

  it("ignores draft, completed, cancelled and expired", () => {
    const featured = featuredRequest([
      job("draft", "draft"),
      job("completed", "completed"),
      job("cancelled", "cancelled"),
      job("expired", "expired"),
    ]);

    expect(featured).toBeNull();
  });

  it("returns null on an empty list", () => {
    expect(featuredRequest([])).toBeNull();
  });

  it("returns the one candidate when only one qualifies", () => {
    const featured = featuredRequest([
      job("completed", "completed"),
      job("in-progress", "in_progress"),
    ]);

    expect(featured?.id).toBe("in-progress");
  });
});

// draft_requests_spec.md §5
describe("featuredRequest — published, not written", () => {
  it("leads with a draft finished today over a request written later but live earlier", () => {
    const finishedToday = {
      ...job("draft-finished", "open", "2026-01-01T00:00:00.000Z"),
      publishedAt: "2026-01-10T00:00:00.000Z",
    } as Job;
    const liveEarlier = {
      ...job("written-later", "open", "2026-01-05T00:00:00.000Z"),
      publishedAt: "2026-01-05T00:00:00.000Z",
    } as Job;

    expect(featuredRequest([liveEarlier, finishedToday])?.id).toBe("draft-finished");
  });
});


/** client_feedback_2026_10_21_spec.md §D1 */
describe("activeRequests", () => {
  const NOW = new Date("2026-10-24T12:00:00.000Z");
  const live = (
    id: string,
    status: ListingStatus,
    publishedAt: string,
    expiresAt = "2026-11-01T00:00:00.000Z"
  ) => ({ id, status, publishedAt, createdAt: publishedAt, expiresAt }) as unknown as Job;

  it("keeps every live request, newest published first", () => {
    const jobs = activeRequests(
      [
        live("a", "open", "2026-10-01T00:00:00.000Z"),
        live("b", "awarded", "2026-10-20T00:00:00.000Z"),
        live("c", "in_progress", "2026-10-10T00:00:00.000Z"),
        live("d", "completed", "2026-10-22T00:00:00.000Z"),
        live("e", "draft", "2026-10-23T00:00:00.000Z"),
      ],
      NOW
    );

    expect(jobs.map((j) => j.id)).toEqual(["b", "c", "a"]);
  });

  it("leaves out an open request past its bidding deadline", () => {
    const jobs = activeRequests(
      [live("stale", "open", "2026-09-24T00:00:00.000Z", "2026-09-27T12:00:00.000Z")],
      NOW
    );

    expect(jobs).toEqual([]);
  });
});
