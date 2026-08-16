import { z } from "zod";
import {
  expedionQuoteStatusEnum,
  expedionPaymentStatusEnum,
  expedionQuoteKindEnum,
} from "@/db/schema/expedion";

// ========================================
// Primitives
// ========================================

export const expedionQuoteStatusSchema = z.enum(
  expedionQuoteStatusEnum.enumValues
);
export const expedionPaymentStatusSchema = z.enum(
  expedionPaymentStatusEnum.enumValues
);
export const expedionQuoteKindSchema = z.enum(expedionQuoteKindEnum.enumValues);

/** Airtable stored everything as text; accept both and normalise. */
const looseNumber = z.union([z.number(), z.string()]).nullish().transform((v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
});

/**
 * The same, for dates — but with `.optional()` outside the transform.
 *
 * `.nullish()` inside it means an absent key still reaches the transform as
 * `undefined` and leaves it as `null`, which Zod then emits. On a patch a
 * present `null` says "clear this column", so every admin PATCH was wiping
 * `escalateAfter` and `storageFreeUntil` on its way past. Outside, an absent
 * key is dropped from the parsed object and only an explicit `null` clears.
 *
 * `looseNumber` has the same shape and the same trap. It is only ever reached
 * through `.partial()` schemas, where Zod short-circuits on `undefined` before
 * the transform runs, so it is safe where it stands — but do not reuse it in a
 * patch schema without moving its optionality out too.
 */
const looseDate = z
  .union([z.string(), z.date()])
  .nullable()
  .transform((v) => {
    if (!v) return null;
    const d = v instanceof Date ? v : new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  })
  .optional();

const trimmed = z.string().trim().min(1).nullish();

// ========================================
// Lot dimensions
// ========================================

export const lotDimensionsSchema = z.object({
  lengthCm: looseNumber,
  widthCm: looseNumber,
  heightCm: looseNumber,
  weightKg: looseNumber,
});

export type LotDimensions = z.infer<typeof lotDimensionsSchema>;

// ========================================
// Create
// ========================================

export const createExpedionQuoteSchema = z.object({
  // Identity is taken from the authenticated caller, never the body — a client
  // must not be able to file a quote under someone else's UID.
  bordereauNumber: trimmed,
  bordereauPaid: z.boolean().optional().default(false),
  bordereauDocUrl: trimmed,
  photoUrls: z.array(z.string().url()).optional(),

  firstName: trimmed,
  lastName: trimmed,
  email: z.string().trim().email().nullish(),
  phone: trimmed,
  clientAddress: trimmed,
  clientPostalCode: trimmed,
  clientCity: trimmed,
  clientCountry: trimmed,

  auctionHouseName: trimmed,
  pickupAddress: trimmed,
  pickupPostalCode: trimmed,
  pickupCity: trimmed,
  pickupPhone: trimmed,
  saleDate: looseDate,

  recipientName: trimmed,
  deliveryAddress: trimmed,
  deliveryAddressLine2: trimmed,
  deliveryPostalCode: trimmed,
  deliveryCity: trimmed,
  deliveryCountry: trimmed,
  deliveryPhone: trimmed,

  description: trimmed,
  lengthCm: looseNumber,
  widthCm: looseNumber,
  heightCm: looseNumber,
  weightKg: looseNumber,
  isProtected: z.boolean().optional().default(false),
  declaredValueCents: z.number().int().nonnegative().nullish(),
  valueBracket: trimmed,

  comment: trimmed,

  storageFreeUntil: looseDate,
  storageDailyFeeCents: z.number().int().nonnegative().nullish(),
});

export type CreateExpedionQuoteInput = z.infer<
  typeof createExpedionQuoteSchema
>;

// ========================================
// Update (client-editable subset)
// ========================================
// The confirm-details screen posts this after the client checks the extraction.

export const updateExpedionQuoteSchema = createExpedionQuoteSchema
  .partial()
  .extend({
    /** Marks the confirm-details step as signed off. */
    confirmExtraction: z.boolean().optional(),
  });

export type UpdateExpedionQuoteInput = z.infer<
  typeof updateExpedionQuoteSchema
>;

// ========================================
// Admin update
// ========================================

/**
 * A true patch: an absent key means "leave the stored value alone", an
 * explicit `null` means "clear it".
 *
 * The two are separate values in the inferred type — `undefined` against
 * `null` — rather than something the service has to reconstruct from the raw
 * body, so a field the operator never touched cannot reach the DAL at all.
 */
export const adminUpdateExpedionQuoteSchema = z.object({
  status: expedionQuoteStatusSchema.optional(),
  paymentStatus: expedionPaymentStatusSchema.optional(),
  quoteStandardCents: z.number().int().nonnegative().nullish(),
  quoteInsuredCents: z.number().int().nonnegative().nullish(),
  quoteAvailable: z.boolean().optional(),
  assignedCarrierId: z.string().nullish(),
  escalateAfter: looseDate,
  storageFreeUntil: looseDate,
  storageDailyFeeCents: z.number().int().nonnegative().nullish(),
  note: trimmed,
});

export type AdminUpdateExpedionQuoteInput = z.infer<
  typeof adminUpdateExpedionQuoteSchema
>;

// ========================================
// Accept a quote
// ========================================

export const acceptExpedionQuoteSchema = z.object({
  kind: expedionQuoteKindSchema,
});

export type AcceptExpedionQuoteInput = z.infer<
  typeof acceptExpedionQuoteSchema
>;

// ========================================
// List filters
// ========================================

export const listExpedionQuotesSchema = z.object({
  status: expedionQuoteStatusSchema.optional(),
  bordereauNumber: z.string().trim().optional(),
  pickupCity: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),

  /**
   * Whose quotes to return. Defaults to the caller's own — for everyone,
   * including admins.
   *
   * Breadth is a deliberate request, never a consequence of who is asking.
   * This is the endpoint the Flutter client's "Mes devis" calls, and it used to
   * widen automatically for admins, so an operator opening their own quote list
   * was served the whole table inside a client UI. `all` is refused for
   * non-admins rather than quietly downgraded, so a client probing for breadth
   * gets an answer that says so.
   */
  scope: z.enum(["mine", "all"]).default("mine"),
});

export type ListExpedionQuotesInput = z.infer<typeof listExpedionQuotesSchema>;

// ========================================
// Status write-back from Expeditoo (Phase D)
// ========================================

export const expedionWriteBackSchema = z.object({
  /** The Expeditoo listing carrying this quote. */
  listingId: z.string().min(1),
  status: expedionQuoteStatusSchema,
  carrierId: z.string().nullish(),
  message: trimmed,
  metadata: z.record(z.unknown()).optional(),
});

export type ExpedionWriteBackInput = z.infer<typeof expedionWriteBackSchema>;
