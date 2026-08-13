import { z } from "zod";

/**
 * Client-side mirror of `src/server/dto/listings.dto.ts`.
 *
 * It exists so the form can validate per step without a round trip; the server
 * remains the authority and re-validates everything on submit.
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

export const LOCATION_TYPE_LABELS: Record<
  (typeof LOCATION_TYPES)[number],
  string
> = {
  house: "House",
  apartment: "Apartment",
  warehouse: "Warehouse",
  factory: "Factory",
  construction_site: "Construction site",
  shop: "Shop",
  office: "Office",
  storage_unit: "Storage unit",
  farm: "Farm",
  port: "Port",
  airport: "Airport",
  rail_terminal: "Rail terminal",
  other: "Other",
};

export const endpointSchema = z
  .object({
    lat: z.number(),
    lng: z.number(),
    address: z.string().min(1, "Address is required"),
    city: z.string().min(1, "City is required"),
    postalCode: z.string().regex(/^\d{5}$/, "Must be 5 digits"),
    locationType: z.enum(LOCATION_TYPES),
    floor: z.coerce.number().int().min(0).optional(),
    hasLift: z.boolean().optional(),
  })
  .superRefine((endpoint, ctx) => {
    // Floor and lift change the work materially, so an apartment must state both.
    if (endpoint.locationType !== "apartment") return;
    if (endpoint.floor === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Floor is required for an apartment",
        path: ["floor"],
      });
    }
    if (endpoint.hasLift === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Tell carriers whether there is a lift",
        path: ["hasLift"],
      });
    }
  });

export const jobFormSchema = z
  .object({
    title: z.string().min(5, "At least 5 characters").max(120),
    description: z.string().min(20, "At least 20 characters").max(5000),
    categoryId: z.string().min(1, "Pick a category"),

    weightKg: z.coerce.number().positive("Must be above 0").max(44_000),
    lengthCm: z.coerce.number().positive().optional(),
    widthCm: z.coerce.number().positive().optional(),
    heightCm: z.coerce.number().positive().optional(),
    quantity: z.coerce.number().int().min(1).default(1),
    isFragile: z.boolean().default(false),
    needsHelp: z.boolean().default(false),

    pickup: endpointSchema,
    dropoff: endpointSchema,

    pickupFrom: z.coerce.date(),
    pickupUntil: z.coerce.date(),
    dropoffFrom: z.coerce.date(),
    dropoffUntil: z.coerce.date(),
    isFlexible: z.boolean().default(false),

    budgetEuros: z.coerce.number().positive("Enter your expected price"),
    photos: z.array(z.string().url()).max(10).default([]),
  })
  .superRefine((data, ctx) => {
    const dims = [data.lengthCm, data.widthCm, data.heightCm];
    const given = dims.filter((d) => d !== undefined).length;
    if (given !== 0 && given !== 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Give all three dimensions, or none",
        path: ["lengthCm"],
      });
    }
    if (data.pickupFrom >= data.pickupUntil) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Pickup window must end after it starts",
        path: ["pickupUntil"],
      });
    }
    if (data.dropoffFrom < data.pickupFrom) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Delivery cannot start before pickup",
        path: ["dropoffFrom"],
      });
    }
    if (data.dropoffFrom >= data.dropoffUntil) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Delivery window must end after it starts",
        path: ["dropoffUntil"],
      });
    }
  });

export type JobFormValues = z.input<typeof jobFormSchema>;
export type JobFormOutput = z.output<typeof jobFormSchema>;

/** Fields validated at each step, so Next only gates on what is on screen. */
export const STEP_FIELDS = [
  ["title", "description", "categoryId", "weightKg", "quantity"],
  ["pickup", "dropoff"],
  ["pickupFrom", "pickupUntil", "dropoffFrom", "dropoffUntil"],
  ["budgetEuros"],
] as const;
