import { carriersDal } from "@/server/dal/carriers.dal";
import { hasAnyRole } from "@/server/services/user.service";
import { roundCoordinate } from "@/lib/listing-coordinates";

/**
 * ============================================================================
 * What a viewer may read of a request
 * ============================================================================
 *
 * The DAL loads a listing whole — the requester's entire `user` row included
 * (`shipper: true`), because the award path needs their Stripe customer id. A
 * route that handed that object to `ok()` published the requester's email,
 * Stripe ids and preferences, the contacts' phones and the access notes to
 * anyone, signed in or not (docs/specs/listing_privacy_spec.md).
 *
 * So nothing leaves through the listing routes unprojected, the owner's own
 * list (`/api/listings/me`) included, and the shipment routes hand the
 * requester and the carrier the listing they carry through here too
 * (`shipment.service.ts`). Every column of `listings` is classified below
 * exactly once — a test fails on one that is not — and the projection keeps
 * listed keys only, so a column added later is private until someone decides
 * otherwise.
 */

/** Any viewer: the job, without where exactly or who. */
export const PUBLIC_LISTING_FIELDS = [
  "id",
  "reference",
  "shipperId",
  "categoryId",
  "status",
  "title",
  "description",
  "weightKg",
  "lengthCm",
  "widthCm",
  "heightCm",
  "quantity",
  "isFragile",
  "needsHelp",
  "packagingLevel",
  "needsProtection",
  "needsPackaging",
  "pickupCity",
  "pickupPostalCode",
  "pickupLocationType",
  "pickupFloor",
  "pickupHasLift",
  "dropoffCity",
  "dropoffPostalCode",
  "dropoffLocationType",
  "dropoffFloor",
  "dropoffHasLift",
  "pickupFrom",
  "pickupUntil",
  "dropoffFrom",
  "dropoffUntil",
  "isFlexible",
  "pickupDays",
  "pickupPeriods",
  "dropoffDays",
  "dropoffPeriods",
  "budgetCents",
  "origin",
  "offersCount",
  "views",
  "expiresAt",
  "reopenedAt",
  "publishedAt",
  "createdAt",
  "updatedAt",
] as const;

/** Where exactly: an approved carrier prices on it, the owner and staff run it. */
export const VETTED_LISTING_FIELDS = ["pickupAddress", "dropoffAddress"] as const;

/** Exact for `vetted` and `full`, about a kilometre out for `public`. */
export const COORDINATE_FIELDS = [
  "pickupLat",
  "pickupLng",
  "dropoffLat",
  "dropoffLng",
] as const;

/**
 * The owner and staff only. The awarded carrier and their driver read the
 * contacts and the notes from the shipment, which copies them at award.
 */
export const PRIVATE_LISTING_FIELDS = [
  "pickupNote",
  "pickupContactName",
  "pickupContactPhone",
  "dropoffNote",
  "dropoffContactName",
  "dropoffContactPhone",
  "externalRef",
  "acceptedOfferId",
  "scheduledPublishAt",
] as const;

/** A person beside a job: enough for an avatar, a name and a rating. */
export const PARTY_FIELDS = ["id", "name", "image", "rating"] as const;
const PHOTO_FIELDS = ["id", "url", "order"] as const;
const CATEGORY_FIELDS = ["id", "name", "slug"] as const;

export type ListingAudience = "full" | "vetted" | "public";

const FIELDS_FOR: Record<ListingAudience, readonly string[]> = {
  full: [
    ...PUBLIC_LISTING_FIELDS,
    ...VETTED_LISTING_FIELDS,
    ...COORDINATE_FIELDS,
    ...PRIVATE_LISTING_FIELDS,
  ],
  vetted: [...PUBLIC_LISTING_FIELDS, ...VETTED_LISTING_FIELDS, ...COORDINATE_FIELDS],
  public: PUBLIC_LISTING_FIELDS,
};

/** Allow-list projection: unknown and future keys are dropped. */
export function project(
  value: unknown,
  fields: readonly string[]
): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  return Object.fromEntries(
    fields.filter((f) => f in source).map((f) => [f, source[f]])
  );
}

/** About a kilometre out — the rounding the board's location filters share. */
const roughly = (value: unknown) =>
  typeof value === "number" ? roundCoordinate(value) : value;

/**
 * One listing as `audience` may read it. Relations are projected too: the
 * requester to `PARTY_FIELDS` for every audience — staff read their email
 * through the admin endpoints, not these.
 */
export function toListingView(
  listing: Record<string, unknown>,
  audience: ListingAudience
): Record<string, unknown> {
  const view = project(listing, FIELDS_FOR[audience]) ?? {};

  if (audience === "public") {
    for (const field of COORDINATE_FIELDS) view[field] = roughly(listing[field]);
  }
  if (Array.isArray(listing.photos)) {
    view.photos = listing.photos.map((photo) => project(photo, PHOTO_FIELDS));
  }
  if ("category" in listing) view.category = project(listing.category, CATEGORY_FIELDS);
  if ("shipper" in listing) view.shipper = project(listing.shipper, PARTY_FIELDS);
  return view;
}

/** What the listing routes need to know about who is asking, read once. */
export interface ListingViewer {
  userId: string;
  isStaff: boolean;
  isApprovedCarrier: boolean;
}

/** Staff here are the roles that run jobs; the admin endpoints serve the rest. */
const STAFF_ROLES = ["admin", "operator"] as const;

export async function resolveListingViewer(
  userId: string | null
): Promise<ListingViewer | null> {
  if (!userId) return null;
  const [isStaff, carrier] = await Promise.all([
    hasAnyRole(userId, [...STAFF_ROLES]),
    carriersDal.getByUserId(userId),
  ]);
  return { userId, isStaff, isApprovedCarrier: carrier?.status === "approved" };
}

export function listingAudience(
  listing: { shipperId: string },
  viewer: ListingViewer | null
): ListingAudience {
  if (!viewer) return "public";
  if (viewer.isStaff || listing.shipperId === viewer.userId) return "full";
  return viewer.isApprovedCarrier ? "vetted" : "public";
}

/**
 * Whether the board's location filters may run on the exact pins for
 * `viewer`: only when they are shown every job's exact pin — staff and
 * approved carriers. Anyone else searches on the rounded pins their cards
 * show, a requester too, since the board is everyone's jobs
 * (listing_privacy_spec.md §3).
 */
export function searchesExactLocation(viewer: ListingViewer | null): boolean {
  return Boolean(viewer && (viewer.isStaff || viewer.isApprovedCarrier));
}

/** The projection for whoever is asking. */
export function viewFor(
  listing: Record<string, unknown> & { shipperId: string },
  viewer: ListingViewer | null
): Record<string, unknown> {
  return toListingView(listing, listingAudience(listing, viewer));
}
