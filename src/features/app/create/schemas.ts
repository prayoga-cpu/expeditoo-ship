import { z } from "zod";
import { isValidPhoneNumber } from "libphonenumber-js/min";

import { JOB_POSTAL_CODE_PATTERN } from "@/lib/postal-code";
import { parseDecimal } from "@/lib/numeric-input";
import {
  TIME_SLOTS,
  toDayString,
  weekdaysBetween,
} from "@/lib/availability-window";

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

/** `MIN_BUDGET_CENTS` / `MAX_BUDGET_CENTS` in `listings.dto.ts`, in euros. */
const BUDGET_EUROS = { min: 1, max: 100_000 };

/**
 * Matches `MAX_QUANTITY` in `listings.dto.ts`: the most items a request may
 * count — all that the quantity box reaches (`NUMERIC_RULES.QUANTITY`), said
 * in words where a sixth digit is refused without a word, and where item rows
 * add up past it (numeric_input_spec.md §8).
 */
const QUANTITY_MAX = 99_999;

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

/** An address as compared for sameness: case, accents and punctuation aside. */
function comparable(text: string | undefined): string {
  return (text ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Whether the two ends are written as the same address
 * (saved_addresses_spec.md §3.3) — whatever their pins say, and whether they
 * came from the address book or were typed. Both must be given: two blank
 * ends are a missing address, said by their own rules.
 */
export function sameEndpoint(
  a: { address?: string; postalCode?: string; city?: string } | undefined,
  b: { address?: string; postalCode?: string; city?: string } | undefined
): boolean {
  if (!a?.address?.trim() || !b?.address?.trim()) return false;
  return (
    comparable(a.address) === comparable(b.address) &&
    comparable(a.postalCode) === comparable(b.postalCode) &&
    comparable(a.city) === comparable(b.city)
  );
}

/**
 * An emptied box reports `""`, which as a number is 0 — passing `.min(0)` and
 * failing `.positive()` with a message about being greater than zero, neither
 * of which is what the person did. Treating blank as absent lets `.optional()`
 * mean what it says.
 */
const blankToUndefined = (value: unknown) =>
  value === "" || value === null ? undefined : value;

/**
 * What a `NumericInput` holds — « 45,5 » in French, « 45.5 » in English — as
 * the number it shows. `z.coerce.number()` read « 45,5 » as NaN: a type error,
 * which aborts the object before its `superRefine`, so the When step's date
 * rules would stop running at the first French comma. Text that is not a
 * number reads as 0 instead, an ordinary issue on its own field
 * (numeric_input_spec.md §7).
 */
const typedNumber = (value: unknown) =>
  typeof value === "string" ? (parseDecimal(value) ?? 0) : value;

/** The same, where a blank box means "not given". */
const optionalTypedNumber = (value: unknown) =>
  typedNumber(blankToUndefined(value));

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
  optionalTypedNumber,
  z.number().positive("create.validation.aboveZero").optional()
);

export const endpointSchema = z
  .object({
    // Optional, matching `listings.dto.ts`: a manually-typed address with no
    // map pin and no pasted link is postable with no coordinates at all.
    lat: z.number().optional(),
    lng: z.number().optional(),
    address: z.string().min(1, "create.validation.addressRequired"),
    city: z.string().min(1, "create.validation.cityRequired"),
    postalCode: z
      .string()
      .regex(JOB_POSTAL_CODE_PATTERN, "create.validation.postalCode"),
    locationType: z.enum(LOCATION_TYPES),
    floor: z.preprocess(
      optionalTypedNumber,
      z
        .number()
        .int("create.validation.wholeNumber")
        .min(0, "create.validation.floorMin")
        .optional()
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
      optionalTypedNumber,
      z
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
    quantity: z
      .preprocess(
        typedNumber,
        z
          .number()
          .int("create.validation.wholeNumber")
          .min(1, "create.validation.quantityMin")
          .max(QUANTITY_MAX, "create.validation.quantityMax")
      )
      .default(1),
    isFragile: z.boolean().default(false),
    // Only meaningful while `isFragile` is on; `toCreatePayload` folds it into
    // `description` rather than the DTO learning a field of its own.
    fragileNote: z
      .string()
      .max(300, "create.validation.fragileNoteMax")
      .optional(),
    needsHelp: z.boolean().default(false),
    packagingLevel: z.enum(["protected", "boxed"]).optional(),
    // Services, beside the state above. `PackagingField` keeps the two from
    // contradicting each other (`isRedundantService`), so nothing here needs to.
    needsProtection: z.boolean().default(false),
    needsPackaging: z.boolean().default(false),

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
    // Derived by `timing.ts` from the When step, never typed: the weekdays
    // and times of day someone is there at each end. Full sets in exact mode
    // (request_availability_spec.md §1).
    pickupDays: z.array(z.number().int().min(1).max(7)),
    pickupPeriods: z.array(z.enum(TIME_SLOTS)),
    dropoffDays: z.array(z.number().int().min(1).max(7)),
    dropoffPeriods: z.array(z.enum(TIME_SLOTS)),

    // Held as the text the box shows (« 40,5 »), seeded "" rather than left
    // unset: blank reads as 0 and fails `.positive()` as an ordinary issue,
    // where an unset value is a type error that would silence the When
    // step's date rules (publication_timing_spec.md §3.6). The bounds are the
    // server's, said here rather than as a failed publish nobody can retry
    // past (numeric_input_spec.md §8).
    budgetEuros: z.preprocess(
      typedNumber,
      z
        .number()
        .positive("create.validation.budgetRequired")
        .min(BUDGET_EUROS.min, "create.validation.budgetMin")
        .max(BUDGET_EUROS.max, "create.validation.budgetMax")
    ),
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

    // The same address at both ends says so in those words, not as two
    // points too close together; and it needs no pin to be seen.
    if (sameEndpoint(data.pickup, data.dropoff)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "create.validation.sameAddress",
        path: ["dropoff", "address"],
      });
    } else if (
      // Only checkable when both ends have a real pin — a manually-typed
      // endpoint on either side leaves nothing to measure, so the guard is
      // skipped rather than half-applied.
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

    // Every weekday unticked between the two dates is a contradiction in what
    // was typed, not a question of time — so, unlike the publication checks in
    // `publication.ts`, it blocks a draft too (request_availability_spec.md §4).
    if (data.isFlexible) {
      const ends = [
        ["pickupDays", data.pickupFrom, data.pickupUntil, data.pickupDays],
        ["dropoffDays", data.dropoffFrom, data.dropoffUntil, data.dropoffDays],
      ] as const;
      for (const [path, from, until, days] of ends) {
        // A cleared date reaches here as the raw string a failed `.pipe` left
        // behind, and an inverted window is reported by the rules above.
        if (!(from instanceof Date) || !(until instanceof Date) || from >= until) {
          continue;
        }
        const inRange = weekdaysBetween(toDayString(from), toDayString(until));
        if (!inRange.some((day) => days.includes(day))) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "create.validation.noAllowedDay",
            path: [path],
          });
        }
      }
    }

    // No rule here compares a date with the clock. When a request may be
    // published is a publication question, asked by `publication.ts` when it
    // is published — never when it is saved as a draft
    // (publication_timing_spec.md §3.6).
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
  [
    "pickupFrom",
    "pickupUntil",
    "dropoffFrom",
    "dropoffUntil",
    "pickupDays",
    "dropoffDays",
  ],
  ["budgetEuros", "publishMode", "scheduledPublishAt"],
] as const;
