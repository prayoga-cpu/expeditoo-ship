/**
 * The two letters an avatar shows when there is no photo: the first of the
 * first name and the first of the last name (client feedback 2026-11-19, #32).
 *
 * `firstName` / `lastName` exist since 2.63.0 and are null on every older
 * account, so `name` is the fallback: its first and its **last** word, because
 * `name` is composed « <first> <last> » and a middle word is more often a
 * second given name than a surname (« Jean Pierre Dupont » is JD). One word
 * gives one letter; nothing gives « ? ».
 *
 * Accents are kept (« Élodie » is É, not E) and a leading quote, bracket or
 * dash is skipped. Code points, not UTF-16 units, so a name outside the BMP
 * does not print half a character.
 */

export interface InitialsSource {
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
}

const LETTER = /[\p{L}\p{N}]/u;

/** The first letter or digit of a word, upper-cased; "" when it has none. */
function initial(word: string | null | undefined): string {
  if (!word) return "";
  const first = Array.from(word.trim()).find((char) => LETTER.test(char));
  return first ? first.toLocaleUpperCase() : "";
}

export function initialsOf({ firstName, lastName, name }: InitialsSource): string {
  const first = initial(firstName);
  const last = initial(lastName);
  if (first && last) return first + last;

  const words = (name ?? "")
    .split(/\s+/)
    .map(initial)
    .filter(Boolean);
  if (words.length >= 2) return words[0] + words[words.length - 1];

  return words[0] ?? (first || last || "?");
}
