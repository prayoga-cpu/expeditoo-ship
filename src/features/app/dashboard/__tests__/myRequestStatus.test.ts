import { describe, it, expect } from "vitest";
import { featuredRequest } from "../myRequestStatus";
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
