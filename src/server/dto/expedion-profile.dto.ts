import { z } from "zod";
import { isValidPhoneNumber, parsePhoneNumber } from "libphonenumber-js/min";
import { namePartSchema } from "@/lib/person-name";

// ========================================
// The Expedion client's own profile — launch_readiness_spec.md §C
// ========================================
//
// What the Flutter app used to keep in Airtable's USERS table: names, a phone
// and one postal address. It now lives in `user`, `user_contact_details` and
// the user's default row in `addresses`.

/** French by default, stored E.164; `""` clears it. */
const phone = z
  .string()
  .trim()
  .max(30)
  .refine((v) => v === "" || isValidPhoneNumber(v, "FR"), "INVALID_PHONE")
  .transform((v) => (v === "" ? "" : parsePhoneNumber(v, "FR").number));

const address = z
  .object({
    line1: z.string().trim().min(1, "REQUIRED").max(200),
    line2: z.string().trim().max(500).nullable().optional(),
    zip: z.string().trim().min(1, "REQUIRED").max(20),
    city: z.string().trim().min(1, "REQUIRED").max(100),
    country: z.string().trim().min(1, "REQUIRED").max(100),
  })
  .strict();

/** Every key optional; an absent key is left as it is. */
export const updateExpedionProfileSchema = z
  .object({
    firstName: namePartSchema.optional(),
    lastName: namePartSchema.optional(),
    phone: phone.optional(),
    address: address.optional(),
  })
  .strict();

export type UpdateExpedionProfileInput = z.infer<
  typeof updateExpedionProfileSchema
>;

export interface ExpedionProfileAddress {
  line1: string;
  line2: string | null;
  zip: string;
  city: string;
  country: string;
}

export interface ExpedionProfileView {
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  address: ExpedionProfileAddress | null;
}
