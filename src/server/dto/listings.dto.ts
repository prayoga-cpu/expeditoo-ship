import { z } from "zod";

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
  categoryId: z.string().min(1),

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

export const browseListingsQuerySchema = z.object({
  categoryId: z.string().optional(),
  q: z.string().optional(),
  nearLat: z.coerce.number().optional(),
  nearLng: z.coerce.number().optional(),
  radiusKm: z.coerce.number().positive().max(1000).optional(),
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
