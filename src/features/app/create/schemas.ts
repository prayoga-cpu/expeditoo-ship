import { z } from "zod";

/**
 * Client-side mirror of `src/server/dto/listings.dto.ts`.
 *
 * It exists so the form can validate per step without a round trip; the server
 * remains the authority and re-validates everything on submit. Where the two
 * disagree the server wins, so every rule here is deliberately a copy of one
 * over there — including the France bounds and the minimum route length, which
 * this mirror used to omit and so let the form pass work the API then rejected
 * with a code the form had no message for.
 *
 * Messages are translation keys rather than English, resolved through
 * `create.validation.*`. A Zod schema cannot call `useTranslations`, so the
 * alternative is a form that validates in one language.
 */

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

export type LocationType = (typeof LOCATION_TYPES)[number];

/** Matches `FRANCE_BOUNDS` in `listings.dto.ts`. */
const FRANCE_BOUNDS = { minLat: 41.3, maxLat: 51.2, minLng: -5.2, maxLng: 9.7 };

/** Matches `MIN_ROUTE_METRES` in `listings.dto.ts`. */
const MIN_ROUTE_METRES = 500;

const isInFrance = (lat: number, lng: number) =>
  lat >= FRANCE_BOUNDS.minLat &&
  lat <= FRANCE_BOUNDS.maxLat &&
  lng >= FRANCE_BOUNDS.minLng &&
  lng <= FRANCE_BOUNDS.maxLng;

function metresBetween(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number
): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * An emptied number input reports `""`, and `z.coerce.number()` reads that as
 * 0 — which passes `.min(0)` and fails `.positive()` with a message about
 * being greater than zero, neither of which is what the person did. Treating
 * blank as absent lets `.optional()` mean what it says.
 */
const blankToUndefined = (value: unknown) =>
  value === "" || value === null ? undefined : value;

/** "YYYY-MM-DDTHH:mm" from a `datetime-local` field, parsed to a Date. */
const datetimeLocal = z
  .string()
  .min(1, "create.validation.dateRequired")
  .pipe(z.coerce.date());

const optionalPositive = z.preprocess(
  blankToUndefined,
  z.coerce.number().positive("create.validation.aboveZero").optional()
);

export const endpointSchema = z
  .object({
    lat: z.number({ message: "create.validation.pinRequired" }),
    lng: z.number({ message: "create.validation.pinRequired" }),
    address: z.string().min(1, "create.validation.addressRequired"),
    city: z.string().min(1, "create.validation.cityRequired"),
    postalCode: z.string().regex(/^\d{5}$/, "create.validation.postalCode"),
    locationType: z.enum(LOCATION_TYPES),
    floor: z.preprocess(
      blankToUndefined,
      z.coerce.number().int().min(0).optional()
    ),
    hasLift: z.boolean().optional(),
  })
  .superRefine((endpoint, ctx) => {
    // Floor and lift change the work materially, so an apartment must state both.
    if (endpoint.locationType === "apartment") {
      if (endpoint.floor === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "create.validation.floorRequired",
          path: ["floor"],
        });
      }
      if (endpoint.hasLift === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "create.validation.liftRequired",
          path: ["hasLift"],
        });
      }
    }

    if (!isInFrance(endpoint.lat, endpoint.lng)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "create.validation.outsideFrance",
        path: ["address"],
      });
    }
  });

export const jobFormSchema = z
  .object({
    title: z.string().min(5, "create.validation.titleShort").max(120),
    description: z
      .string()
      .min(20, "create.validation.descriptionShort")
      .max(5000),

    weightKg: z.coerce
      .number()
      .positive("create.validation.aboveZero")
      .max(44_000, "create.validation.weightMax"),
    lengthCm: optionalPositive,
    widthCm: optionalPositive,
    heightCm: optionalPositive,
    quantity: z.coerce.number().int().min(1).default(1),
    isFragile: z.boolean().default(false),
    needsHelp: z.boolean().default(false),

    pickup: endpointSchema,
    dropoff: endpointSchema,

    // A `datetime-local` input hands back a string, so the field is typed as
    // one and piped into a Date. `z.coerce.date()` alone declares its *input*
    // as Date too, which made the form's own default values a type error and
    // would have hidden any real mismatch behind a cast.
    pickupFrom: datetimeLocal,
    pickupUntil: datetimeLocal,
    dropoffFrom: datetimeLocal,
    dropoffUntil: datetimeLocal,
    isFlexible: z.boolean().default(false),

    budgetEuros: z.coerce
      .number()
      .positive("create.validation.budgetRequired"),
    photos: z.array(z.string().url()).max(10).default([]),
  })
  .superRefine((data, ctx) => {
    const dims = [data.lengthCm, data.widthCm, data.heightCm];
    const given = dims.filter((d) => d !== undefined).length;
    if (given !== 0 && given !== 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "create.validation.dimensionsPartial",
        path: ["lengthCm"],
      });
    }

    if (
      metresBetween(
        data.pickup.lat,
        data.pickup.lng,
        data.dropoff.lat,
        data.dropoff.lng
      ) < MIN_ROUTE_METRES
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "create.validation.tooClose",
        path: ["dropoff", "address"],
      });
    }

    if (data.pickupFrom >= data.pickupUntil) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "create.validation.pickupWindow",
        path: ["pickupUntil"],
      });
    }
    if (data.dropoffFrom < data.pickupFrom) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "create.validation.deliveryBeforePickup",
        path: ["dropoffFrom"],
      });
    }
    if (data.dropoffFrom >= data.dropoffUntil) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "create.validation.deliveryWindow",
        path: ["dropoffUntil"],
      });
    }
  });

export type JobFormValues = z.input<typeof jobFormSchema>;
export type JobFormOutput = z.output<typeof jobFormSchema>;

/** Fields validated at each step, so Next only gates on what is on screen. */
export const STEP_FIELDS = [
  ["title", "description", "weightKg", "quantity", "lengthCm"],
  ["pickup", "dropoff"],
  ["pickupFrom", "pickupUntil", "dropoffFrom", "dropoffUntil"],
  ["budgetEuros"],
] as const;
