import { z } from "zod";

import { EMAIL_CODE_LENGTH } from "@/lib/email-code";

const SIX_DIGITS = new RegExp(`^\\d{${EMAIL_CODE_LENGTH}}$`);

/**
 * `POST /api/account/verify-email-code` (email_access_code_spec.md §5).
 *
 * The code is taken as it was pasted — « 123 456 » — and must be exactly six
 * digits once its spaces are gone; anything else is refused before the
 * service counts an attempt against it.
 */
export const verifyEmailCodeSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  code: z
    .string()
    .max(32)
    .transform((raw) => raw.replace(/\s+/g, ""))
    .pipe(z.string().regex(SIX_DIGITS, "The code is six digits")),
});

export type VerifyEmailCodeInput = z.infer<typeof verifyEmailCodeSchema>;

/** What a right code answers. Nothing about the account beyond the address it was sent. */
export interface VerifyEmailCodeResult {
  verified: true;
  email: string;
}
