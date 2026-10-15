import { z } from "zod";
import { isValidPhoneNumber } from "libphonenumber-js/min";
import { aliasSchema, namePartSchema } from "@/lib/person-name";

// ========================================
// Personal contact details — client_feedback_2026_10_spec.md §7b
// ========================================

/**
 * A phone as `PhoneInput` sends it (E.164), validated the way a job's contact
 * phone is on `/create`. An empty string clears it.
 */
const optionalPhone = z
  .string()
  .trim()
  .max(30)
  .refine((v) => v === "" || isValidPhoneNumber(v, "FR"), "INVALID_PHONE");

/**
 * Every field optional: the card sends what it shows, and an absent key is
 * left as it is. A name part cannot be cleared — `user.name` is composed from
 * the two — only changed.
 */
export const updateUserContactSchema = z
  .object({
    firstName: namePartSchema.optional(),
    lastName: namePartSchema.optional(),
    alias: aliasSchema.optional(),
    phone: optionalPhone.optional(),
    relativeName: z.string().trim().max(80).optional(),
    relativePhone: optionalPhone.optional(),
  })
  .strict();

export type UpdateUserContactInput = z.infer<typeof updateUserContactSchema>;

/** What the owner — or staff — reads back. Nobody else reads it at all. */
export interface UserContactView {
  name: string;
  firstName: string | null;
  lastName: string | null;
  alias: string | null;
  phone: string | null;
  relativeName: string | null;
  relativePhone: string | null;
}
