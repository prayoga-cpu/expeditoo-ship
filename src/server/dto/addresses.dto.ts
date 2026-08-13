import { z } from "zod";

// ========================================
// Input Schemas
// ========================================

export const createAddressSchema = z.object({
  label: z.string().min(1, "Label is required").max(50),
  street: z.string().min(1, "Street is required").max(200),
  city: z.string().min(1, "City is required").max(100),
  zip: z.string().min(1, "ZIP code is required").max(20),
  country: z.string().min(1, "Country is required").max(100),
  details: z.string().max(500).optional(), // Floor, apt number, building color, etc.
  lat: z.number().optional(),
  lng: z.number().optional(),
  isDefault: z.boolean().default(false),
});

export const updateAddressSchema = createAddressSchema.partial();

// ========================================
// Output Schemas
// ========================================

export const addressOutputSchema = z.object({
  id: z.string(),
  userId: z.string(),
  label: z.string(),
  street: z.string(),
  city: z.string(),
  zip: z.string(),
  country: z.string(),
  details: z.string().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  isDefault: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// ========================================
// Type Exports
// ========================================

export type CreateAddressInput = z.infer<typeof createAddressSchema>;
export type UpdateAddressInput = z.infer<typeof updateAddressSchema>;
export type AddressOutput = z.infer<typeof addressOutputSchema>;
