import { z } from "zod";

/**
 * A person's name in parts: first name, last name and an optional alias
 * (client_feedback_2026_10_spec.md §1, §7b).
 *
 * One definition for the sign-up form, Better Auth's `additionalFields`
 * validators, and the profile's contact card, so the three cannot disagree on
 * what a valid name is. `user.name` stays the display string and is always
 * composed from the parts, never typed separately.
 */

export const NAME_PART_MAX = 80;
export const ALIAS_MAX = 40;

/** A first or last name: trimmed, 1–80 characters. */
export const namePartSchema = z
  .string()
  .trim()
  .min(1, "NAME_REQUIRED")
  .max(NAME_PART_MAX, "NAME_TOO_LONG");

/** An alias: trimmed, at most 40 characters; empty means none. */
export const aliasSchema = z.string().trim().max(ALIAS_MAX, "ALIAS_TOO_LONG");

/** The display name the rest of the app reads from `user.name`. */
export function composeName(firstName: string, lastName: string): string {
  return `${firstName.trim()} ${lastName.trim()}`.trim();
}

/**
 * A best guess at the parts of a name typed whole, for prefilling a form the
 * person then corrects — never stored on its own say-so. The first word is the
 * first name, the rest the last name: right for « Jean Dupont », wrong for
 * « Jean-Pierre de La Fontaine »'s particle only in where the reader expects
 * the split, which is why it is a prefill.
 */
export function splitName(name: string | null | undefined): {
  firstName: string;
  lastName: string;
} {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return { firstName: "", lastName: "" };
  return { firstName: words[0], lastName: words.slice(1).join(" ") };
}
