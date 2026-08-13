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

const looseDate = z
  .union([z.string(), z.date()])
  .nullish()
  .transform((v) => {
    if (!v) return null;
    const d = v instanceof Date ? v : new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  });

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
