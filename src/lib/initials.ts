/**
 * Up to two letters for a person — the avatar, and the reminder beside a
 * requester's name on the staff tables (client_feedback_2026_10_29_spec.md
 * §A4): the first of each of the first two words of the name, or the email's
 * first letter when there is no name.
 */
export function initialsOf(
  name: string | null | undefined,
  email: string | null | undefined
): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length > 0) {
    return words
      .slice(0, 2)
      .map((word) => word.charAt(0).toUpperCase())
      .join("");
  }
  return (email ?? "").trim().charAt(0).toUpperCase();
}
