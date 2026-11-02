import { z } from "zod";
import {
  ISO_WEEKDAYS,
  MAX_AVAILABILITY_DAYS,
  TIME_SLOTS,
} from "@/lib/availability-window";
import { MAX_PATH_POINTS } from "@/lib/route-corridor";
import { isInCountry, isJobCountry, isValidPostalCode } from "@/lib/countries";
import { floorRequired, liftRequired, LOCATION_TYPES } from "@/lib/location-types";
import { JOB_KINDS, MOVING_SURFACE_M2, MOVING_VOLUME_M3 } from "@/lib/moving";
import { PACKAGING_SERVICES, isRedundantService } from "@/lib/cargo-packaging";
import { listingOriginEnum, listingStatusEnum } from "@/db/schema/listings";

// ========================================
// Listings DTO — the transport job
// ========================================
// See docs/specs/transport_listing_spec.md §2.

// One list for the enum, this DTO and the form (src/lib/location-types.ts).
export { LOCATION_TYPES };

export const MIN_BUDGET_CENTS = 100;
export const MAX_BUDGET_CENTS = 10_000_000;
/** French road transport limit. */
export const MAX_WEIGHT_KG = 44_000;
/** The most items one request counts — all the form's quantity box reaches. */
export const MAX_QUANTITY = 99_999;
/** Minimum separation between pickup and dropoff, in metres. */
export const MIN_ROUTE_METRES = 500;

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
  // Optional: a requester who types the address by hand, with no map pin and
  // no pasted link, can post with no coordinates at all. `address`/`city`/
  // `postalCode` stay required either way — a job always needs a readable
  // destination, coordinates are the map's convenience on top of that.
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  // Its format is the country's, checked below with the country beside it
  // (client_feedback_2026_10_31_spec.md §6.3).
  postalCode: z.string().trim().min(1, "INVALID_POSTAL_CODE").max(12, "INVALID_POSTAL_CODE"),
  // ISO 3166-1 alpha-2; absent means France — every caller before 2.76.0, and
  // escalation's pickup. Any code here, because an escalated job delivers
  // wherever its quote does; a request posted over HTTP is held to
  // `JOB_COUNTRIES` below (client_feedback_2026_10_31_spec.md §6.3).
  country: z.string().regex(/^[A-Z]{2}$/, "UNSUPPORTED_COUNTRY").optional(),
  locationType: z.enum(LOCATION_TYPES),
  floor: z.number().int().min(0).optional(),
  hasLift: z.boolean().optional(),
  // Access instructions for the carrier ("second floor, past the red door")
  // and who they actually call there. Left lenient here — no phone format
  // enforced, both optional — because `expedionEscalationService` populates
  // these from `expedion_quotes.pickup_phone` / `delivery_phone`, which is
  // free-typed, nullable Airtable-imported data. `create.schemas.ts` is where
  // a person posting a direct job is held to a real, internationally valid
  // number; the server only refuses to store more than a page of text.
  note: z.string().max(300).optional(),
  contactName: z.string().max(120).optional(),
  contactPhone: z.string().max(30).optional(),
}).superRefine((endpoint, ctx) => {
  // On the end itself, beside its country, so they run whatever else in the
  // payload is wrong — as the regex they replace did
  // (client_feedback_2026_10_31_spec.md §6.3).
  if (endpoint.country !== undefined && !isJobCountry(endpoint.country)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "UNSUPPORTED_COUNTRY",
      path: ["country"],
    });
  }
  if (!isValidPostalCode(endpoint.country, endpoint.postalCode)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "INVALID_POSTAL_CODE",
      path: ["postalCode"],
    });
  }
  // Nothing to bound-check for a pin-less, manually-typed endpoint — there is
  // no coordinate to be out of its country. The address itself is not
  // verified against any gazetteer; that is the tradeoff this mode accepts.
  if (
    endpoint.lat !== undefined &&
    endpoint.lng !== undefined &&
    !isInCountry(endpoint.country, endpoint.lat, endpoint.lng)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "LOCATION_OUT_OF_COUNTRY",
      path: ["lat"],
    });
  }
});

/**
 * The floor and the lift materially change the job, so they are required
 * rather than merely encouraged by the UI: on an apartment, and on every place
 * with floors when the job is a move. The lift only from the first floor up —
 * a ground floor has nothing to climb (client_feedback_2026_10_31_spec.md §3).
 */
const requireFloorDetail = (
  endpoint: z.infer<typeof endpointSchema>,
  ctx: z.RefinementCtx,
  side: "pickup" | "dropoff",
  isMoving: boolean
) => {
  const type = endpoint.locationType;
  const prefix = type === "apartment" ? "APARTMENT_" : "";
  if (floorRequired(type, isMoving) && endpoint.floor === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `${prefix}FLOOR_REQUIRED`,
      path: [side, "floor"],
    });
  }
  if (liftRequired(type, isMoving, endpoint.floor) && endpoint.hasLift === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `${prefix}LIFT_REQUIRED`,
      path: [side, "hasLift"],
    });
  }
};

const hasNoDuplicates = (values: readonly unknown[]) =>
  new Set(values).size === values.length;

/**
 * Who is there, when, at one end of a request (request_availability_spec.md
 * §3). Absent means unrestricted — the column default — so these are
 * `.optional()`, never `.default()`: a defaulted field becomes required on
 * `CreateListingInput`, and the escalation literal would have to name it.
 */
const weekdaySet = z
  .array(z.number().int().min(1).max(7))
  .min(1)
  .max(7)
  .refine(hasNoDuplicates, "DUPLICATE_WEEKDAY")
  .transform((days) =>
    ISO_WEEKDAYS.filter((day) => days.includes(day))
  );

const periodSet = z
  .array(z.enum(TIME_SLOTS))
  .min(1)
  .max(TIME_SLOTS.length)
  .refine(hasNoDuplicates, "DUPLICATE_PERIOD")
  .transform((periods) =>
    TIME_SLOTS.filter((period) => periods.includes(period))
  );

const AVAILABILITY_FIELDS = [
  ["pickupDays", ISO_WEEKDAYS.length],
  ["pickupPeriods", TIME_SLOTS.length],
  ["dropoffDays", ISO_WEEKDAYS.length],
  ["dropoffPeriods", TIME_SLOTS.length],
] as const;

const baseListingSchema = z.object({
  // Absent means items, as every request was before 2.76.0.
  jobKind: z.enum(JOB_KINDS).optional(),
  title: z.string().min(2).max(120),
  // Optional (client_feedback_2026_10_spec.md §8). The column stays NOT NULL,
  // so an absent description is stored as "" rather than null.
  description: z.string().max(5000).default(""),
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
  quantity: z.number().int().min(1).max(MAX_QUANTITY).default(1),
  isFragile: z.boolean().default(false),
  needsHelp: z.boolean().default(false),
  // Absent means "not stated", not "unprotected" — the same convention
  // `legal_form` uses (admin_user_management_spec.md), never guessed at.
  packagingLevel: z.enum(["protected", "boxed"]).optional(),
  // Services the carrier performs, as distinct from the state above
  // (cargo_packaging_services_spec.md).
  needsProtection: z.boolean().default(false),
  needsPackaging: z.boolean().default(false),
  // A move's size: one of the two, as the requester gave it (spec §2.3).
  movingSurfaceM2: z
    .number()
    .int()
    .min(MOVING_SURFACE_M2.min)
    .max(MOVING_SURFACE_M2.max)
    .optional(),
  movingVolumeM3: z
    .number()
    .min(MOVING_VOLUME_M3.min)
    .max(MOVING_VOLUME_M3.max)
    .optional(),

  pickup: endpointSchema,
  dropoff: endpointSchema,

  pickupFrom: z.coerce.date(),
  pickupUntil: z.coerce.date(),
  dropoffFrom: z.coerce.date(),
  dropoffUntil: z.coerce.date(),
  isFlexible: z.boolean().default(false),
  pickupDays: weekdaySet.optional(),
  pickupPeriods: periodSet.optional(),
  dropoffDays: weekdaySet.optional(),
  dropoffPeriods: periodSet.optional(),

  budgetCents: z.number().int().min(MIN_BUDGET_CENTS).max(MAX_BUDGET_CENTS),
  photos: z.array(z.string().url()).max(10).default([]),
  publish: z.boolean().default(false),
  /**
   * A future instant to go live at instead of `publish: true`'s usual "now".
   * Shape-only here (a Date, optionally absent); "not in the past" and "not
   * after its own pickup" are wall-clock checks and belong in the service,
   * the same way `pickupFrom <= now` already does (see `createListing`).
   */
  scheduledPublishAt: z.coerce.date().optional(),
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

  const isMoving = data.jobKind === "moving";
  const sizes = [data.movingSurfaceM2, data.movingVolumeM3].filter(
    (size) => size !== undefined
  ).length;
  if (isMoving && sizes !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "MOVING_SIZE_REQUIRED",
      path: ["movingSurfaceM2"],
    });
  } else if (!isMoving && sizes > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "MOVING_SIZE_ON_ITEMS",
      path: ["movingSurfaceM2"],
    });
  }

  for (const [side, endpoint] of [
    ["pickup", data.pickup],
    ["dropoff", data.dropoff],
  ] as const) {
    requireFloorDetail(endpoint, ctx, side, isMoving);
  }

  // Only checkable when both ends have real coordinates — a manually-typed
  // endpoint on either side means there is no distance to measure, so the
  // guard is skipped rather than half-applied against whichever side has a pin.
  const separation =
    data.pickup.lat !== undefined &&
    data.pickup.lng !== undefined &&
    data.dropoff.lat !== undefined &&
    data.dropoff.lng !== undefined
      ? metresBetween(
          data.pickup.lat,
          data.pickup.lng,
          data.dropoff.lat,
          data.dropoff.lng
        )
      : null;
  if (separation !== null && separation < MIN_ROUTE_METRES) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "PICKUP_DROPOFF_TOO_CLOSE",
      path: ["dropoff"],
    });
  }

  // "Already boxed" beside "needs packing" tells the carrier two opposite
  // things; the form never produces the pair, so only a hand-built call can.
  if (
    PACKAGING_SERVICES.some(
      (service) => data[service] && isRedundantService(data.packagingLevel, service)
    )
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "PACKAGING_CONTRADICTION",
      path: ["packagingLevel"],
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

  // Weekdays and times of day narrow a flexible range; an exact request names
  // its own hour, so a narrower set beside it would contradict it. Whether
  // the range contains an allowed weekday needs the requester's calendar,
  // which this payload does not carry — the form checks that one.
  if (!data.isFlexible) {
    for (const [field, full] of AVAILABILITY_FIELDS) {
      const set = data[field];
      if (set && set.length < full) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "AVAILABILITY_REQUIRES_FLEXIBLE",
          path: [field],
        });
      }
    }
  }
});

export type CreateListingInput = z.infer<typeof createListingSchema>;

export const updateListingSchema = baseListingSchema
  .omit({ publish: true, scheduledPublishAt: true })
  .partial();

export type UpdateListingInput = z.infer<typeof updateListingSchema>;

/**
 * Fields a carrier prices the job on. Editing any of them invalidates every
 * live offer (transport_listing_spec.md §4), so the set is defined once here
 * and consumed by the service.
 */
export const MATERIAL_FIELDS = [
  "jobKind",
  "movingSurfaceM2",
  "movingVolumeM3",
  "weightKg",
  "lengthCm",
  "widthCm",
  "heightCm",
  "quantity",
  "needsHelp",
  "isFragile",
  "packagingLevel",
  "needsProtection",
  "needsPackaging",
  "pickup",
  "dropoff",
  "pickupFrom",
  "pickupUntil",
  "dropoffFrom",
  "dropoffUntil",
  "isFlexible",
  "pickupDays",
  "pickupPeriods",
  "dropoffDays",
  "dropoffPeriods",
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

/**
 * `GET /api/admin/listings` — a moderation view over every job, not just the
 * open ones a driver can bid on. `browseListingsQuerySchema` above is the
 * board's own filter set (corridor, radius, availability) and hardcodes
 * `status = 'open'` in `listingsDal.browse`; reusing it here would make a
 * draft, awarded, in-progress, completed or cancelled job invisible to staff.
 */
export const adminListingsQuerySchema = z.object({
  status: z.enum(listingStatusEnum.enumValues).optional(),
  // Absent means both inlets. `direct` is what Supervision's "Demandes
  // directes" panel reads (request_summary_spec.md §3.1).
  origin: z.enum(listingOriginEnum.enumValues).optional(),
  // "true" leaves out what nobody has posted yet: drafts and requests
  // scheduled for later. Only their author may open those, so a staff list
  // that links to them leads to a page that never loads
  // (request_summary_spec.md §3.1).
  posted: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type AdminListingsQuery = z.infer<typeof adminListingsQuerySchema>;

export type BrowseListingsQuery = z.infer<typeof browseListingsQuerySchema>;
