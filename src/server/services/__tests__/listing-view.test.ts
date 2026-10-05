import { describe, expect, it, vi } from "vitest";
import { getTableColumns } from "drizzle-orm";

vi.mock("@/server/services/user.service", () => ({ hasAnyRole: vi.fn() }));
vi.mock("@/server/dal/carriers.dal", () => ({ carriersDal: { getByUserId: vi.fn() } }));

import { listings } from "@/db/schema/listings";
import { hasAnyRole } from "@/server/services/user.service";
import { carriersDal } from "@/server/dal/carriers.dal";
import {
  COORDINATE_FIELDS,
  PRIVATE_LISTING_FIELDS,
  PUBLIC_LISTING_FIELDS,
  VETTED_LISTING_FIELDS,
  listingAudience,
  resolveListingViewer,
  searchesExactLocation,
  toListingView,
} from "../listing-view";

/**
 * What each viewer may read of a request (listing_privacy_spec.md). The DAL
 * hands the services the whole row and the requester's whole account; only
 * these projections may leave through the listing routes.
 */

const CLASSIFIED = [
  ...PUBLIC_LISTING_FIELDS,
  ...VETTED_LISTING_FIELDS,
  ...COORDINATE_FIELDS,
  ...PRIVATE_LISTING_FIELDS,
];

/** Every column of `listings` with a recognisable value, plus the relations. */
function fixture(): Record<string, unknown> & { shipperId: string } {
  const row: Record<string, unknown> = {};
  for (const column of Object.keys(getTableColumns(listings))) {
    row[column] = `value-of-${column}`;
  }
  return {
    ...row,
    shipperId: "requester-1",
    pickupLat: 45.764043,
    pickupLng: 4.835659,
    dropoffLat: 43.296482,
    dropoffLng: 5.36978,
    pickupContactPhone: "+33612345678",
    shipper: {
      id: "requester-1",
      name: "Mat",
      image: null,
      rating: 4.5,
      email: "mat@example.com",
      stripeCustomerId: "cus_123",
      stripeAccountId: "acct_123",
      preferences: { notifications: {} },
      lastLoginAt: new Date(),
    },
    photos: [{ id: "p1", url: "https://x/p1.jpg", order: 0, listingId: "l1", createdAt: new Date() }],
    category: { id: "c1", name: "Transport", slug: "transport", description: "d", image: null, parentId: null },
  };
}

describe("the column classification", () => {
  it("classifies every column of listings exactly once", () => {
    const columns = Object.keys(getTableColumns(listings)).sort();

    expect([...CLASSIFIED].sort()).toEqual(columns);
    expect(new Set(CLASSIFIED).size).toBe(CLASSIFIED.length);
  });
});

describe("toListingView", () => {
  it("gives the public the job without where exactly or who", () => {
    const view = toListingView(fixture(), "public");

    for (const field of PUBLIC_LISTING_FIELDS) expect(view).toHaveProperty(field);
    for (const field of [...VETTED_LISTING_FIELDS, ...PRIVATE_LISTING_FIELDS]) {
      expect(view).not.toHaveProperty(field);
    }
    // About a kilometre out.
    expect(view.pickupLat).toBe(45.76);
    expect(view.dropoffLng).toBe(5.37);
  });

  it("adds the streets and the exact pins for an approved carrier, and nothing else", () => {
    const view = toListingView(fixture(), "vetted");

    expect(view.pickupAddress).toBe("value-of-pickupAddress");
    expect(view.pickupLat).toBe(45.764043);
    for (const field of PRIVATE_LISTING_FIELDS) expect(view).not.toHaveProperty(field);
  });

  it("gives the owner and staff the contacts and the notes", () => {
    const view = toListingView(fixture(), "full");

    expect(view.pickupContactPhone).toBe("+33612345678");
    expect(view.pickupNote).toBe("value-of-pickupNote");
    expect(view.externalRef).toBe("value-of-externalRef");
  });

  it.each(["public", "vetted", "full"] as const)(
    "never carries the requester's account to %s",
    (audience) => {
      const view = toListingView(fixture(), audience);

      expect(Object.keys(view.shipper as object).sort()).toEqual([
        "id",
        "image",
        "name",
        "rating",
      ]);
      expect(JSON.stringify(view)).not.toMatch(/mat@example\.com|cus_123|acct_123/);
    }
  );

  it("projects the photos and the category too", () => {
    const view = toListingView(fixture(), "public");

    expect(view.photos).toEqual([{ id: "p1", url: "https://x/p1.jpg", order: 0 }]);
    expect(view.category).toEqual({ id: "c1", name: "Transport", slug: "transport" });
  });

  it("drops a key nobody classified", () => {
    const view = toListingView({ ...fixture(), somethingNew: "secret" }, "full");

    expect(view).not.toHaveProperty("somethingNew");
  });
});

describe("listingAudience", () => {
  const listing = { shipperId: "requester-1" };
  const viewer = (over: Partial<{ userId: string; isStaff: boolean; isApprovedCarrier: boolean }> = {}) => ({
    userId: "someone",
    isStaff: false,
    isApprovedCarrier: false,
    ...over,
  });

  it("reads the owner and staff in full", () => {
    expect(listingAudience(listing, viewer({ userId: "requester-1" }))).toBe("full");
    expect(listingAudience(listing, viewer({ isStaff: true }))).toBe("full");
  });

  it("reads an approved carrier as vetted", () => {
    expect(listingAudience(listing, viewer({ isApprovedCarrier: true }))).toBe("vetted");
  });

  it("reads everyone else as public", () => {
    expect(listingAudience(listing, viewer())).toBe("public");
    expect(listingAudience(listing, null)).toBe("public");
  });
});

describe("searchesExactLocation", () => {
  const viewer = (over: Partial<{ isStaff: boolean; isApprovedCarrier: boolean }> = {}) => ({
    userId: "someone",
    isStaff: false,
    isApprovedCarrier: false,
    ...over,
  });

  it("lets staff and approved carriers search the pins they are shown exactly", () => {
    expect(searchesExactLocation(viewer({ isStaff: true }))).toBe(true);
    expect(searchesExactLocation(viewer({ isApprovedCarrier: true }))).toBe(true);
  });

  it("searches everyone else on the rounded pins", () => {
    // A requester included: the board is everyone's jobs, and theirs is one.
    expect(searchesExactLocation(viewer())).toBe(false);
    expect(searchesExactLocation(null)).toBe(false);
  });
});

describe("resolveListingViewer", () => {
  it("is nobody when signed out", async () => {
    expect(await resolveListingViewer(null)).toBeNull();
  });

  it("vets an approved carrier only", async () => {
    vi.mocked(hasAnyRole).mockResolvedValue(false);
    vi.mocked(carriersDal.getByUserId).mockResolvedValue({ status: "pending" } as never);
    expect((await resolveListingViewer("u1"))?.isApprovedCarrier).toBe(false);

    vi.mocked(carriersDal.getByUserId).mockResolvedValue({ status: "approved" } as never);
    expect((await resolveListingViewer("u1"))?.isApprovedCarrier).toBe(true);
  });

  it("takes admin and operator as staff", async () => {
    vi.mocked(hasAnyRole).mockResolvedValue(true);
    vi.mocked(carriersDal.getByUserId).mockResolvedValue(undefined);

    expect((await resolveListingViewer("u1"))?.isStaff).toBe(true);
    expect(hasAnyRole).toHaveBeenCalledWith("u1", ["admin", "operator"]);
  });
});
