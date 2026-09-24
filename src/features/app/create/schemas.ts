import { z } from "zod";
import { isValidPhoneNumber } from "libphonenumber-js/min";

import {
  HEAVY_BRACKET_ID,
  HEAVY_BRACKET_MIN_KG,
  SIZE_MODES,
  SIZE_PRESET_IDS,
  UNSURE_BRACKET_ID,
  WEIGHT_BRACKET_IDS,
  WEIGHT_BRACKET_MAX_KG,
} from "./cargo";

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
 *
 * Three fields deliberately have no counterpart over there. `weightBracket` and
 * `sizePreset` are how a person answers "how heavy" and "how big"; `fragileNote`
 * is the optional detail a person adds once `isFragile` is on. All three are
 * resolved into fields the API already has in `api/jobs.api.ts`, which is the
 * only seam that had to move. See docs/specs/cargo_input_spec.md §2.
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

export const PUBLISH_MODES = ["now", "schedule"] as const;
export type PublishMode = (typeof PUBLISH_MODES)[number];

/** Empty when unscheduled; the same wire shape as `datetimeLocal` once chosen. */
const optionalDatetimeLocal = z.preprocess(
  blankToUndefined,
  z.string().pipe(z.coerce.date()).optional()
);

const optionalPositive = z.preprocess(
  blankToUndefined,
  z.coerce.number().positive("create.validation.aboveZero").optional()
);

export const endpointSchema = z
  .object({
    // Optional, matching `listings.dto.ts`: a manually-typed address with no
    // map pin and no pasted link is postable with no coordinates at all.
    lat: z.number().optional(),
    lng: z.number().optional(),
    address: z.string().min(1, "create.validation.addressRequired"),
    city: z.string().min(1, "create.validation.cityRequired"),
    postalCode: z.string().regex(/^\d{5}$/, "create.validation.postalCode"),
    locationType: z.enum(LOCATION_TYPES),
    floor: z.preprocess(
      blankToUndefined,
      z.coerce.number().int().min(0).optional()
    ),
    hasLift: z.boolean().optional(),
    // What the carrier cannot see from the street, and who they call once
    // they get there. The requester posting the job is not always the person
    // present at either end.
    note: z.string().max(300, "create.validation.noteMax").optional(),
    contactName: z
      .string()
      .max(120, "create.validation.contactNameMax")
      .optional(),
    // `PhoneInput` emits E.164 (`+33612345678`), which carries its own
    // country and needs no fallback. A bare national number can still reach
    // here from an old saved draft, so "FR" is only a default for that case —
    // it is ignored the moment the string already starts with a `+`.
    contactPhone: z
      .string()
      .refine(
        (v) => isValidPhoneNumber(v, "FR"),
        "create.validation.invalidPhone"
      ),
    // Client-only, like `fragileNote`: no counterpart in `listings.dto.ts`.
    // `useJobForm`'s `handleNext` reads these off the Where step and calls
    // the address book directly; `toCreatePayload` strips both before the
    // job payload goes out.
    saveAddress: z.boolean().default(false),
    addressLabel: z.string().max(50).optional(),
    // Client-only too: which way `LocationPickerField` was given the place.
    // Held here rather than in the picker so it survives the step unmounting,
    // and so the rule below can read it.
    locationEntry: z.enum(["assisted", "address", "link"]).optional(),
  })
  .superRefine((endpoint, ctx) => {
    // A map link gives the carrier a point, not what to look for there — the
    // gate, the barn, the loading bay. The note says that, so a place given
    // as a link must carry one.
    if (endpoint.locationEntry === "link") {
      if (endpoint.lat === undefined || endpoint.lng === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "create.validation.mapLinkRequired",
          path: ["lat"],
        });
      }
      if (!endpoint.note?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "create.validation.linkNoteRequired",
          path: ["note"],
        });
      }
    }

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

    if (
      endpoint.lat !== undefined &&
      endpoint.lng !== undefined &&
      !isInFrance(endpoint.lat, endpoint.lng)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "create.validation.outsideFrance",
        path: ["address"],
      });
    }
  });

export const jobFormSchema = z
  .object({
    title: z.string().min(2, "create.validation.titleShort").max(120),
    description: z
      .string()
      .min(5, "create.validation.descriptionShort")
      .max(5000),

    /**
     * Weight is picked from a bracket, not typed: a person moving a sofa does
     * not know it weighs 78 kg. `exactWeightKg` is the one free entry left, and
     * only `over1000` asks for it — the DTO accepts up to 44 t and no ladder of
     * chips can express a part-loaded lorry.
     */
    weightBracket: z.enum(WEIGHT_BRACKET_IDS, {
      message: "create.validation.weightRequired",
    }),
    exactWeightKg: z.preprocess(
      blankToUndefined,
      z.coerce
        .number()
        .positive("create.validation.aboveZero")
        .max(44_000, "create.validation.weightMax")
        .optional()
    ),

    sizeMode: z.enum(SIZE_MODES).default("preset"),
    sizePreset: z.enum(SIZE_PRESET_IDS).optional(),
    lengthCm: optionalPositive,
    widthCm: optionalPositive,
    heightCm: optionalPositive,
    quantity: z.coerce.number().int().min(1).default(1),
    isFragile: z.boolean().default(false),
    // Only meaningful while `isFragile` is on; `toCreatePayload` folds it into
    // `description` rather than the DTO learning a field of its own.
    fragileNote: z
      .string()
      .max(300, "create.validation.fragileNoteMax")
      .optional(),
    needsHelp: z.boolean().default(false),
    packagingLevel: z.enum(["protected", "boxed"]).optional(),

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

    publishMode: z.enum(PUBLISH_MODES).default("now"),
    scheduledPublishAt: optionalDatetimeLocal,
  })
  .superRefine((data, ctx) => {
    if (data.weightBracket === HEAVY_BRACKET_ID) {
      if (data.exactWeightKg === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "create.validation.weightRequired",
          path: ["exactWeightKg"],
        });
      } else if (data.exactWeightKg <= HEAVY_BRACKET_MIN_KG) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "create.validation.weightAboveBracket",
          path: ["exactWeightKg"],
        });
      }
    } else if (
      data.weightBracket &&
      data.weightBracket !== UNSURE_BRACKET_ID &&
      data.exactWeightKg !== undefined
    ) {
      // The optional figure refines the chosen bracket rather than replacing
      // it — going over the ceiling means the bracket itself was too low.
      const ceiling = WEIGHT_BRACKET_MAX_KG[data.weightBracket];
      if (ceiling !== null && data.exactWeightKg > ceiling) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "create.validation.weightExceedsBracket",
          path: ["exactWeightKg"],
        });
      }
    }

    // Only in `exact` mode: the three fields are off screen under a preset, and
    // a stale value one of them still holds must not fail a submit.
    if (data.sizeMode === "exact") {
      const dims = [data.lengthCm, data.widthCm, data.heightCm];
      const given = dims.filter((d) => d !== undefined).length;
      if (given !== 0 && given !== 3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "create.validation.dimensionsPartial",
          path: ["lengthCm"],
        });
      }
    }

    // Only checkable when both ends have a real pin — a manually-typed
    // endpoint on either side leaves nothing to measure, so the guard is
    // skipped rather than half-applied.
    if (
      data.pickup.lat !== undefined &&
      data.pickup.lng !== undefined &&
      data.dropoff.lat !== undefined &&
      data.dropoff.lng !== undefined &&
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

    if (data.publishMode === "schedule") {
      if (!data.scheduledPublishAt) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "create.validation.scheduledPublishRequired",
          path: ["scheduledPublishAt"],
        });
      } else if (data.scheduledPublishAt <= new Date()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "create.validation.scheduledPublishPast",
          path: ["scheduledPublishAt"],
        });
      } else if (data.scheduledPublishAt >= data.pickupFrom) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "create.validation.scheduledPublishAfterPickup",
          path: ["scheduledPublishAt"],
        });
      }
    }
  });

export type JobFormValues = z.input<typeof jobFormSchema>;
export type JobFormOutput = z.output<typeof jobFormSchema>;

/** Fields validated at each step, so Next only gates on what is on screen. */
export const STEP_FIELDS = [
  [
    "title",
    "description",
    "weightBracket",
    "exactWeightKg",
    "quantity",
    "lengthCm",
    "fragileNote",
  ],
  ["pickup", "dropoff"],
  ["pickupFrom", "pickupUntil", "dropoffFrom", "dropoffUntil"],
  ["budgetEuros", "publishMode", "scheduledPublishAt"],
] as const;
