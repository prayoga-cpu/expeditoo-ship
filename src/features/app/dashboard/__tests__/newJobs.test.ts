import { describe, expect, it } from "vitest";
import { countNewJobs } from "../hooks/useDriverDashboard";

const NOW = new Date("2026-11-07T12:00:00Z").getTime();
const ago = (hours: number) => new Date(NOW - hours * 3600_000).toISOString();

describe("countNewJobs — « N nouvelles courses » on the home page", () => {
  it("counts the jobs that went live in the last 24 hours, by the day they were published", () => {
    const { count } = countNewJobs(
      [
        { createdAt: ago(80), publishedAt: ago(2) }, // drafted days ago, live now
        { createdAt: ago(5) },
        { createdAt: ago(23) },
        { createdAt: ago(30) },
      ],
      NOW,
      50
    );
    expect(count).toBe(3);
  });

  it("says « 50+ » when a whole page is new", () => {
    const items = Array.from({ length: 50 }, () => ({ createdAt: ago(1) }));
    expect(countNewJobs(items, NOW, 50)).toEqual({ count: 50, capped: true });
    expect(countNewJobs(items.slice(1), NOW, 50).capped).toBe(false);
  });
});
