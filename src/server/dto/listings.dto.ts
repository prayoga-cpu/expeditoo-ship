import { z } from "zod";
import {
  MAX_AVAILABILITY_DAYS,
  TIME_SLOTS,
} from "@/lib/availability-window";
import { MAX_PATH_POINTS } from "@/lib/route-corridor";

// ========================================
// Listings DTO — the transport job
// ========================================
// See docs/specs/transport_listing_spec.md §2.

export const LOCATION_TYPES = [
  "house",
  "apartment",
  "warehouse",
  "factory",
  "construction_site",
  "shop",
  "office",
  "storage_unit",
  "farm",
  "port",
  "airport",
  "rail_terminal",
  "other",
] as const;

export const MIN_BUDGET_CENTS = 100;
export const MAX_BUDGET_CENTS = 10_000_000;
/** French road transport limit. */
export const MAX_WEIGHT_KG = 44_000;
/** Minimum separation between pickup and dropoff, in metres. */
export const MIN_ROUTE_METRES = 500;

/** Metropolitan France plus Corsica. v2.0 is France-only (ROADMAP.md §9). */
const FRANCE_BOUNDS = { minLat: 41.3, maxLat: 51.2, minLng: -5.2, maxLng: 9.7 };

const isInFrance = (lat: number, lng: number) =>
  lat >= FRANCE_BOUNDS.minLat &&
  lat <= FRANCE_BOUNDS.maxLat &&
  lng >= FRANCE_BOUNDS.minLng &&
  lng <= FRANCE_BOUNDS.maxLng;

/** Equirectangular approximation, ample for a 500 m proximity guard. */
const metresBetween = (
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number
) => {
  const x = ((bLng - aLng) * Math.PI * 6371000 * Math.cos((aLat * Math.PI) / 180)) / 180;
  const y = ((bLat - aLat) * Math.PI * 6371000) / 180;
  return Math.sqrt(x * x + y * y);
};

const endpointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  postalCode: z.string().regex(/^\d{5}$/, "INVALID_POSTAL_CODE"),
  locationType: z.enum(LOCATION_TYPES),
  floor: z.number().int().min(0).optional(),
  hasLift: z.boolean().optional(),
});

/**
 * An apartment's floor and lift materially change the job, so they are
 * required rather than merely encouraged by the UI.
 */
const requireApartmentDetail = (
  endpoint: z.infer<typeof endpointSchema>,
  ctx: z.RefinementCtx,
  side: "pickup" | "dropoff"
) => {
  if (endpoint.locationType !== "apartment") return;
  if (endpoint.floor === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "APARTMENT_FLOOR_REQUIRED",
      path: [side, "floor"],
    });
  }
  if (endpoint.hasLift === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "APARTMENT_LIFT_REQUIRED",
      path: [side, "hasLift"],
    });
  }
};

const baseListingSchema = z.object({
  title: z.string().min(5).max(120),
  description: z.string().min(20).max(5000),
  /**
   * Optional because a person requesting transport is not asked to file their
   * own belongings into a taxonomy — they describe an object and two addresses.
   * When it is absent the service resolves a default, the same way escalation
   * already does for a quote arriving from Expedion. An explicit id is still
   * honoured, so an internal caller that knows the right category keeps it.
   */
  categoryId: z.string().min(1).optional(),

  weightKg: z.number().positive().max(MAX_WEIGHT_KG),
  lengthCm: z.number().positive().optional(),
  widthCm: z.number().positive().optional(),
  heightCm: z.number().positive().optional(),
  quantity: z.number().int().min(1).default(1),
  isFragile: z.boolean().default(false),
  needsHelp: z.boolean().default(false),

  pickup: endpointSchema,
  dropoff: endpointSchema,

  pickupFrom: z.coerce.date(),
  pickupUntil: z.coerce.date(),
  dropoffFrom: z.coerce.date(),
  dropoffUntil: z.coerce.date(),
  isFlexible: z.boolean().default(false),

  budgetCents: z.number().int().min(MIN_BUDGET_CENTS).max(MAX_BUDGET_CENTS),
  photos: z.array(z.string().url()).max(10).default([]),
  publish: z.boolean().default(false),
});

export const createListingSchema = baseListingSchema.superRefine((data, ctx) => {
  // Dimensions are all-or-nothing: a half-described box cannot be matched to a
  // vehicle, so partial input is rejected rather than silently ignored.
  const dims = [data.lengthCm, data.widthCm, data.heightCm];
  const given = dims.filter((d) => d !== undefined).length;
  if (given !== 0 && given !== 3) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "DIMENSIONS_INCOMPLETE",
      path: ["lengthCm"],
    });
  }

  for (const [side, endpoint] of [
    ["pickup", data.pickup],
    ["dropoff", data.dropoff],
  ] as const) {
    if (!isInFrance(endpoint.lat, endpoint.lng)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "LOCATION_OUT_OF_COUNTRY",
        path: [side, "lat"],
      });
    }
    requireApartmentDetail(endpoint, ctx, side);
  }

  const separation = metresBetween(
    data.pickup.lat,
    data.pickup.lng,
    data.dropoff.lat,
    data.dropoff.lng
  );
  if (separation < MIN_ROUTE_METRES) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "PICKUP_DROPOFF_TOO_CLOSE",
      path: ["dropoff"],
    });
  }

  if (data.pickupFrom >= data.pickupUntil) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "INVALID_PICKUP_WINDOW",
      path: ["pickupUntil"],
    });
  }
  if (data.dropoffFrom >= data.dropoffUntil) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "INVALID_DROPOFF_WINDOW",
      path: ["dropoffUntil"],
    });
  }
  if (data.dropoffFrom < data.pickupFrom) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "DROPOFF_BEFORE_PICKUP",
      path: ["dropoffFrom"],
    });
  }
});

export type CreateListingInput = z.infer<typeof createListingSchema>;

export const updateListingSchema = baseListingSchema
  .omit({ publish: true })
  .partial();

export type UpdateListingInput = z.infer<typeof updateListingSchema>;

/**
 * Fields a carrier prices the job on. Editing any of them invalidates every
 * live offer (transport_listing_spec.md §4), so the set is defined once here
 * and consumed by the service.
 */
export const MATERIAL_FIELDS = [
  "weightKg",
  "lengthCm",
  "widthCm",
  "heightCm",
  "quantity",
  "needsHelp",
  "isFragile",
  "pickup",
  "dropoff",
  "pickupFrom",
  "pickupUntil",
  "dropoffFrom",
  "dropoffUntil",
] as const satisfies readonly (keyof UpdateListingInput)[];

/** A comma-separated query parameter, as the URL carries it. */
const csv = <T extends z.ZodTypeAny>(item: T) =>
  z.preprocess(
    (value) =>
      typeof value === "string"
        ? value
            .split(",")
            .map((entry) => entry.trim())
            .filter(Boolean)
        : value,
    z.array(item)
  );

export const browseListingsQuerySchema = z.object({
  categoryId: z.string().optional(),
  q: z.string().optional(),
  /**
   * Where the job came from. Expedion escalation is the only inlet now, so the
   * board passes `expedion` to keep legacy `direct` rows — seeded or left over
   * from the shipper-posting era — off the carrier's list.
   */
  origin: z.enum(["direct", "expedion"]).optional(),

  /**
   * Where the driver starts, and — in "sur mon trajet" — where they are going.
   *
   * The search mode is derived rather than declared: an arrival makes the
   * filter a corridor, its absence makes it a radius. There is no `mode`
   * parameter, so no request can claim one thing and carry the other
   * (board_route_search_spec.md §2).
   */
  fromLat: z.coerce.number().min(-90).max(90).optional(),
  fromLng: z.coerce.number().min(-180).max(180).optional(),
  toLat: z.coerce.number().min(-90).max(90).optional(),
  toLng: z.coerce.number().min(-180).max(180).optional(),
  /**
   * The étapes between them: `lat,lng` pairs joined by `;`, because a comma
   * already separates the halves of one pair — Cocolis's "Ajouter une étape".
   * A driver routing Bordeaux → Limoges → Paris is describing a different
   * corridor from the straight line, and the filter follows the path they
   * named rather than the one geometry would infer.
   */
  via: z
    .preprocess(
      (value) =>
        typeof value === "string"
          ? value
              .split(";")
              .map((entry) => entry.trim())
              .filter(Boolean)
              .map((entry) => {
                // `Number("")` is 0, so a half-written pair like "45.7," would
                // otherwise pass as a real point in the Atlantic. NaN is what
                // makes `z.number()` reject it.
                const halves = entry.split(",");
                const [lat, lng] = halves.map((half) =>
                  halves.length === 2 && half.trim() !== ""
                    ? Number(half)
                    : Number.NaN
                );
                return { lat, lng };
              })
          : value,
      z.array(
        z.object({
          lat: z.number().min(-90).max(90),
          lng: z.number().min(-180).max(180),
        })
      )
    )
    .refine((values) => values.length <= MAX_PATH_POINTS - 2, {
      message: "TOO_MANY_WAYPOINTS",
    })
    .optional(),
  /** Radius around the departure, or half-width of the corridor. */
  radiusKm: z.coerce.number().positive().max(1000).optional(),

  /**
   * The days the driver can drive, and the times of day within them. A job
   * matches when its pickup window overlaps any one of them — overlap, not
   * containment, because a fortnight-wide window is exactly what the driver is
   * trying to narrow (board_route_search_spec.md §5).
   */
  days: csv(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "INVALID_DAY"))
    .refine((values) => values.length <= MAX_AVAILABILITY_DAYS, {
      message: "TOO_MANY_DAYS",
    })
    .optional(),
  slots: csv(z.enum(TIME_SLOTS)).optional(),
  /** The client's `getTimezoneOffset()`, so a slot means their hour, not UTC. */
  tzOffset: z.coerce.number().int().min(-840).max(840).default(0),
  minBudget: z.coerce.number().int().optional(),
  maxBudget: z.coerce.number().int().optional(),
  pickupFrom: z.coerce.date().optional(),
  pickupUntil: z.coerce.date().optional(),
  maxWeightKg: z.coerce.number().positive().optional(),
  sort: z
    .enum(["created_desc", "budget_desc", "budget_asc", "pickup_asc", "distance_asc"])
    .default("created_desc"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type BrowseListingsQuery = z.infer<typeof browseListingsQuerySchema>;
