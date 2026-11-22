/**
 * How a person is named in the inbox and beside a bubble: their pseudo, as
 * « @pseudo », when they chose one — otherwise their name, as before
 * (client feedback 2026-11-19, #32: « Don't need to see full name with
 * firstname… and also user name »).
 *
 * The thread header keeps the full name with the pseudo beside it: there you
 * are talking to a person. The avatar's two letters stay the real initials
 * (lib/initials.ts) either way.
 *
 * A pseudo was typed under « vous seul le voyez » until 2.94.0; the copy
 * changed in the same release that started showing it here.
 */

export interface NamedPerson {
  name?: string | null;
  alias?: string | null;
}

/** « @pseudo », or null when the person has none. A typed « @ » is not doubled. */
export function pseudoOf(person: NamedPerson | null | undefined): string | null {
  const alias = (person?.alias ?? "").trim().replace(/^@+/, "");
  return alias ? `@${alias}` : null;
}

/** The pseudo when there is one, the name otherwise; "" when there is neither. */
export function displayNameOf(person: NamedPerson | null | undefined): string {
  return pseudoOf(person) ?? (person?.name ?? "").trim();
}
