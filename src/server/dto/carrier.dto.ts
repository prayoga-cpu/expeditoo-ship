import { z } from "zod";
import {
  isValidSiret,
  isValidIban,
  isValidBic,
  isValidPlate,
  isValidFrenchPhone,
  VAT_PATTERN,
  POSTAL_CODE_PATTERN,
} from "@/lib/french-identifiers";
import {
  VEHICLE_TYPES,
  DOCUMENT_KINDS,
  ACCEPTED_DOCUMENT_MIME_TYPES,
  MAX_DOCUMENT_BYTES,
} from "@/lib/carrier-constants";

// ========================================
// Carrier DTO
// ========================================
// See docs/specs/carrier_kyc_spec.md §3.

/**
 * The vocabulary itself lives in `@/lib/carrier-constants` so the carrier
 * screens can share it without pulling a server module into the client bundle.
 */
export {
  VEHICLE_TYPES,
  DOCUMENT_KINDS,
  REQUIRED_DOCUMENT_KINDS,
  EXPIRING_DOCUMENT_KINDS,
  ACCEPTED_DOCUMENT_MIME_TYPES,
  MAX_DOCUMENT_BYTES,
} from "@/lib/carrier-constants";

export const upsertCarrierSchema = z.object({
  companyName: z.string().min(2).max(200),
  siret: z.string().refine(isValidSiret, "INVALID_SIRET"),
  vatNumber: z.string().regex(VAT_PATTERN, "INVALID_VAT").optional(),
  legalForm: z.string().max(100).optional(),
  contactPhone: z.string().refine(isValidFrenchPhone, "INVALID_PHONE"),
  addressLine: z.string().min(1).max(300),
  city: z.string().min(1).max(120),
  postalCode: z.string().regex(POSTAL_CODE_PATTERN, "INVALID_POSTAL_CODE"),
  bio: z.string().max(2000).optional(),
});

export type UpsertCarrierInput = z.infer<typeof upsertCarrierSchema>;

/**
 * Banking details are validated here and then forwarded to Stripe. Only the
 * last 4 of each are persisted (carrier_kyc_spec.md §4.3), so this input shape
 * deliberately has no counterpart in the carriers table.
 */
export const carrierBankingSchema = z.object({
  iban: z.string().refine(isValidIban, "INVALID_IBAN"),
  bic: z.string().refine(isValidBic, "INVALID_BIC"),
});

export type CarrierBankingInput = z.infer<typeof carrierBankingSchema>;

export const createVehicleSchema = z.object({
  type: z.enum(VEHICLE_TYPES),
  make: z.string().max(80).optional(),
  model: z.string().max(80).optional(),
  year: z.number().int().min(1950).max(new Date().getFullYear() + 1).optional(),
  plateNumber: z.string().refine(isValidPlate, "INVALID_PLATE"),
  maxWeightKg: z.number().positive().max(44_000),
  maxLengthCm: z.number().positive().optional(),
  maxWidthCm: z.number().positive().optional(),
  maxHeightCm: z.number().positive().optional(),
  features: z.array(z.string()).default([]),
});

export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;

export const updateVehicleSchema = createVehicleSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;

export const uploadDocumentSchema = z.object({
  kind: z.enum(DOCUMENT_KINDS),
  objectKey: z.string().min(1),
  mimeType: z.enum(ACCEPTED_DOCUMENT_MIME_TYPES, {
    errorMap: () => ({ message: "UNSUPPORTED_DOCUMENT_TYPE" }),
  }),
  sizeBytes: z.number().int().positive().max(MAX_DOCUMENT_BYTES),
  expiresAt: z.coerce.date().optional(),
});

export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;

export const rejectCarrierSchema = z.object({
  reason: z.string().min(3).max(1000),
});

export const suspendCarrierSchema = z.object({
  reason: z.string().min(3).max(1000),
});
