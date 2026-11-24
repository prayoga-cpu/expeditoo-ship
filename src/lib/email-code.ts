/**
 * The access code a verification mail carries beside its link, as both ends
 * read it: the server's validation (`email-code.dto.ts`) and the field on
 * `/verify-email` (email_access_code_spec.md §2).
 */

/** Six digits: short enough to read off a phone, five tries make it unguessable. */
export const EMAIL_CODE_LENGTH = 6;

/**
 * How long a verification lasts, link and code alike.
 *
 * Better Auth's link expiry defaults to the same hour; `src/lib/auth.ts` hands
 * it this constant rather than leaning on the default, so the code can never
 * outlive or undercut the link it travels with. The mail says « 1 heure »:
 * change one, change the other.
 */
export const EMAIL_VERIFICATION_TTL_SECONDS = 60 * 60;

/**
 * What a person typed or pasted, reduced to the code's digits:
 * « 123 456 », « 123-456 » and « 123456 » are one code.
 */
export function codeDigits(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, EMAIL_CODE_LENGTH);
}
