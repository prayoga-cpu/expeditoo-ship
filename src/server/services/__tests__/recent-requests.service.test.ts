import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTableColumns } from "drizzle-orm";

// listing-view.ts reads the viewer through these; nothing here has a viewer.
vi.mock("@/server/services/user.service", () => ({ hasAnyRole: vi.fn() }));
vi.mock("@/server/dal/carriers.dal", () => ({ carriersDal: { getByUserId: vi.fn() } }));
vi.mock("@/server/dal/recent-requests.dal", () => ({
  recentRequestsDal: { latestOpen: vi.fn() },
}));

import { listings } from "@/db/schema/listings";
import { recentRequestsDal } from "@/server/dal/recent-requests.dal";
import {
  RECENT_REQUEST_FIELDS,
  RECENT_REQUESTS_LIMIT,
} from "@/server/dto/recent-requests.dto";
import { PUBLIC_LISTING_FIELDS } from "../listing-view";
import { recentRequestsService } from "../recent-requests.service";

/**
 * landing_2026_11_spec.md §4 — « Demandes récentes » is read by anyone and
 * cached at the edge, so it is the `public` projection of a request, narrowed
 * to a card. The read is handed the whole row here, every column of
 * `listings` and the relations the board joins, to prove the service — not
 * the DAL's `select` — is what keeps the rest off the wire.
 */

const latestOpen = vi.mocked(recentRequestsDal.latestOpen);
const NOW = new Date("2026-11-24T10:00:00Z");

let seq = 0;
/** A whole listing row: every column, plus the requester and photos. */
function wholeRow(over: Record<string, unknown> = {}) {
  seq += 1;
  const row: Record<string, unknown> = {};
  for (const column of Object.keys(getTableColumns(listings))) {
    row[column] = `value-of-${column}`;
  }
  return {
    ...row,
    id: `job-${seq}`,
    reference: 100000 + seq,
    status: "open",
    jobKind: "items",
    title: "Canapé 3 places",
    pickupCity: "Paris",
    pickupCountry: "FR",
    dropoffCity: "Lyon",
    dropoffCountry: "FR",
    pickupFrom: new Date("2026-11-26T08:00:00Z"),
    pickupUntil: new Date("2026-11-28T18:00:00Z"),
    isFlexible: true,
    weightKg: 45,
    movingSurfaceM2: null,
    movingVolumeM3: null,
    pickupLat: 48.85661,
    pickupLng: 2.35222,
    dropoffLat: 45.76404,
    dropoffLng: 4.83566,
    budgetCents: 15000,
    shipper: { id: "u1", name: "Jeanne", email: "jeanne@example.test", stripeCustomerId: "cus_1" },
    photos: [{ id: "p1", url: "https://r2/p1.jpg", order: 0 }],
    ...over,
  } as never;
}

beforeEach(() => {
  latestOpen.mockReset();
  seq = 0;
});

describe("recentRequestsService.list", () => {
  it("pins the card to its fourteen fields — a fifteenth fails here", () => {
    expect([...RECENT_REQUEST_FIELDS].sort()).toEqual(
      [
        "id",
        "reference",
        "title",
        "jobKind",
        "pickupCity",
        "pickupCountry",
        "dropoffCity",
        "dropoffCountry",
        "pickupFrom",
        "pickupUntil",
        "isFlexible",
        "weightKg",
        "movingSurfaceM2",
        "movingVolumeM3",
      ].sort()
    );
  });

  it("names only fields the public projection already shows anyone", () => {
    const outside = RECENT_REQUEST_FIELDS.filter(
      (field) => !(PUBLIC_LISTING_FIELDS as readonly string[]).includes(field)
    );
    expect(outside).toEqual([]);
  });

  it("returns exactly the card's fields from a whole row", async () => {
    latestOpen.mockResolvedValue([wholeRow()]);

    const { items } = await recentRequestsService.list(NOW);

    expect(items).toHaveLength(1);
    expect(Object.keys(items[0]).sort()).toEqual([...RECENT_REQUEST_FIELDS].sort());
  });

  it("never carries a street, a pin, a contact, a note, a budget, a photo or the requester", async () => {
    latestOpen.mockResolvedValue([wholeRow()]);

    const [item] = (await recentRequestsService.list(NOW)).items;
    const wire = JSON.stringify(item);

    for (const key of [
      "pickupAddress",
      "pickupPostalCode",
      "pickupLat",
      "dropoffLng",
      "pickupContactPhone",
      "dropoffContactName",
      "pickupNote",
      "description",
      "budgetCents",
      "shipperId",
      "shipper",
      "photos",
      "externalRef",
      "offersCount",
    ]) {
      expect(item).not.toHaveProperty(key);
    }
    expect(wire).not.toContain("jeanne@example.test");
    expect(wire).not.toContain("cus_1");
    expect(wire).not.toContain("value-of-pickupAddress");
    expect(wire).not.toContain("48.85");
  });

  it("sends timestamps as ISO strings", async () => {
    latestOpen.mockResolvedValue([wholeRow()]);

    const [item] = (await recentRequestsService.list(NOW)).items;

    expect(item.pickupFrom).toBe("2026-11-26T08:00:00.000Z");
    expect(item.pickupUntil).toBe("2026-11-28T18:00:00.000Z");
  });

  it(`asks for ${RECENT_REQUESTS_LIMIT} and never returns more`, async () => {
    latestOpen.mockResolvedValue(Array.from({ length: 9 }, () => wholeRow()));

    const { items } = await recentRequestsService.list(NOW);

    expect(latestOpen).toHaveBeenCalledWith(RECENT_REQUESTS_LIMIT, NOW);
    expect(items).toHaveLength(RECENT_REQUESTS_LIMIT);
    expect(items.map((item) => item.id)).toEqual([
      "job-1",
      "job-2",
      "job-3",
      "job-4",
      "job-5",
      "job-6",
    ]);
  });

  it("shows open requests only, whatever the read returned", async () => {
    latestOpen.mockResolvedValue([
      wholeRow({ status: "draft" }),
      wholeRow({ status: "open" }),
      wholeRow({ status: "awarded" }),
      wholeRow({ status: "scheduled" }),
      wholeRow({ status: "cancelled" }),
      wholeRow({ status: "open" }),
    ]);

    const { items } = await recentRequestsService.list(NOW);

    expect(items.map((item) => item.id)).toEqual(["job-2", "job-6"]);
  });

  it("answers an empty list when nothing is open", async () => {
    latestOpen.mockResolvedValue([]);
    expect(await recentRequestsService.list(NOW)).toEqual({ items: [] });
  });

  it("carries a move's size and its kind", async () => {
    latestOpen.mockResolvedValue([
      wholeRow({ jobKind: "moving", movingSurfaceM2: 40, movingVolumeM3: null }),
    ]);

    const [item] = (await recentRequestsService.list(NOW)).items;

    expect(item.jobKind).toBe("moving");
    expect(item.movingSurfaceM2).toBe(40);
  });
});
