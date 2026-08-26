import { z } from "zod";
import { POSTAL_CODE_PATTERN } from "@/lib/french-identifiers";
import { carrierRouteKindEnum } from "@/db/schema/carrier-routes";

// ========================================
// Carrier Routes DTO
// ========================================
// See docs/specs/carrier_trips_spec.md §4. Every rule below is enforced here
// rather than in the dialog: the API is reachable without the UI.

/** Derived from the enum, never restated (CLAUDE.md gotcha 8). */
export const carrierRouteKindSchema = z.enum(carrierRouteKindEnum.enumValues);

/** A carrier may hold at most this many trips; deleting is the way down. */
export const MAX_ROUTES_PER_CARRIER = 20;

/** A single occasional trip cannot enumerate more dates than this. */
export const MAX_ROUTE_DATES = 60;

const endpointSchema = z.object({
  address: z.string().min(3).max(300),
  city: z.string().min(1).max(120),
  postalCode: z.string().regex(POSTAL_CODE_PATTERN, "INVALID_POSTAL_CODE"),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const dayOfWeekSchema = z.number().int().min(1).max(7);

const noDuplicates = <T>(values: T[]) => new Set(values).size === values.length;

const baseRouteSchema = z.object({
  label: z.string().max(120).optional(),
  kind: carrierRouteKindSchema,
  origin: endpointSchema,
  destination: endpointSchema,
  radiusKm: z.number().int().min(1).max(500).default(50),
  /** ISO weekdays; recurring trips only. */
  daysOfWeek: z.array(dayOfWeekSchema).max(7).optional(),
  /** Specific dates; occasional trips only. */
  dates: z.array(z.coerce.date()).max(MAX_ROUTE_DATES).optional(),
  validFrom: z.coerce.date().optional(),
  validUntil: z.coerce.date().optional(),
  vehicleId: z.string().min(1).optional(),
  capacityKg: z.number().positive().max(100_000).optional(),
  notifyOnMatch: z.boolean().default(true),
  isActive: z.boolean().default(true),
});

/**
 * The kind decides which "when" field is legal, so the two can never both be
 * populated and neither can be empty. Applied to the *resulting* row on PATCH,
 * not to the patch itself — see `updateCarrierRouteSchema`.
 */
function refineKindConsistency(
  value: {
    kind: "recurring" | "occasional";
    daysOfWeek?: number[];
    dates?: Date[];
    validFrom?: Date;
    validUntil?: Date;
  },
  ctx: z.RefinementCtx
) {
  if (value.kind === "recurring") {
    if (!value.daysOfWeek?.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["daysOfWeek"],
        message: "RECURRING_REQUIRES_DAYS",
      });
    }
    if (value.dates?.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dates"],
        message: "RECURRING_REJECTS_DATES",
      });
    }
  }

  if (value.kind === "occasional") {
    if (!value.dates?.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dates"],
        message: "OCCASIONAL_REQUIRES_DATES",
      });
    }
    if (value.daysOfWeek?.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["daysOfWeek"],
        message: "OCCASIONAL_REJECTS_DAYS",
      });
    }
  }

  if (value.daysOfWeek && !noDuplicates(value.daysOfWeek)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["daysOfWeek"],
      message: "DUPLICATE_DAYS",
    });
  }

  if (value.dates && !noDuplicates(value.dates.map((d) => d.getTime()))) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["dates"],
      message: "DUPLICATE_DATES",
    });
  }

  if (
    value.validFrom &&
    value.validUntil &&
    value.validUntil <= value.validFrom
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["validUntil"],
      message: "INVALID_VALIDITY_WINDOW",
    });
  }
}

export const createCarrierRouteSchema =
  baseRouteSchema.superRefine(refineKindConsistency);

/**
 * Every field optional, but the merged row still has to satisfy the kind rules.
 * The service merges the patch onto the stored row and runs
 * `createCarrierRouteSchema` over the result, so this schema only has to
 * describe shape.
 */
export const updateCarrierRouteSchema = baseRouteSchema.partial().extend({
  label: z.string().max(120).nullable().optional(),
  vehicleId: z.string().min(1).nullable().optional(),
  capacityKg: z.number().positive().max(100_000).nullable().optional(),
  validFrom: z.coerce.date().nullable().optional(),
  validUntil: z.coerce.date().nullable().optional(),
});

export type CreateCarrierRouteInput = z.infer<typeof createCarrierRouteSchema>;
export type UpdateCarrierRouteInput = z.infer<typeof updateCarrierRouteSchema>;
export type CarrierRouteEndpoint = z.infer<typeof endpointSchema>;
