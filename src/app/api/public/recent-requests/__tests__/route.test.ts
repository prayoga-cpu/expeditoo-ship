import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * landing_2026_11_spec.md §4.3 — the route adds two things to the service:
 * it reads no session, and it lets a CDN keep a success for a minute (and
 * only a success). The projection itself is tested on the service.
 */

const getSession = vi.fn();
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/server/services/recent-requests.service", () => ({
  recentRequestsService: { list: vi.fn() },
}));

import { GET } from "../route";
import { recentRequestsService } from "@/server/services/recent-requests.service";

const list = vi.mocked(recentRequestsService.list);

const ITEM = {
  id: "job-1",
  reference: 100001,
  title: "Canapé 3 places",
  jobKind: "items" as const,
  pickupCity: "Paris",
  pickupCountry: "FR",
  dropoffCity: "Lyon",
  dropoffCountry: "FR",
  pickupFrom: "2026-11-26T08:00:00.000Z",
  pickupUntil: "2026-11-28T18:00:00.000Z",
  isFlexible: true,
  weightKg: 45,
  movingSurfaceM2: null,
  movingVolumeM3: null,
};

beforeEach(() => {
  list.mockReset();
  getSession.mockReset();
});

describe("GET /api/public/recent-requests", () => {
  it("answers the service's list without asking who is there", async () => {
    list.mockResolvedValue({ items: [ITEM] });

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: { items: [ITEM] } });
    expect(getSession).not.toHaveBeenCalled();
  });

  it("lets a shared cache keep a success for sixty seconds", async () => {
    list.mockResolvedValue({ items: [] });

    const res = await GET();
    const cache = res.headers.get("Cache-Control") ?? "";

    expect(cache).toContain("public");
    expect(cache).toContain("s-maxage=60");
    // Browsers revalidate: the minute is the edge's, not each visitor's.
    expect(cache).toContain("max-age=0");
  });

  it("caches no failure", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    list.mockRejectedValue(new Error("db down"));

    const res = await GET();

    expect(res.status).toBe(500);
    expect(res.headers.get("Cache-Control") ?? "").not.toContain("s-maxage");
  });
});
