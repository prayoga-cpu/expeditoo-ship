/**
 * Splitting a French auction buyer's name into a given name and a surname.
 *
 * French bordereaux do not agree on word order — "DUPONT Jean", "M. Jean
 * DUPONT" and "Mme LE GALL Anne" are all the same shape of person — so taking
 * the first token as the first name is wrong roughly half the time. What the
 * documents *do* agree on is capitalisation: the surname is printed in caps,
 * whichever side of the given name it sits on. That is the signal this parser
 * leans on, and it is why order is inferred rather than assumed.
 *
 * Nothing here is allowed to invent a name. A company, a lone token or an
 * unreadable string yields `null` for the half we cannot justify, because
 * every caller filters nulls out before writing to the quote — a null leaves
 * whatever the client typed by hand intact, while a wrong guess overwrites it.
 * `fullName` always carries the original back, so no reading of the slip is
 * ever lost to the split.
 */

export interface ParsedName {
  firstName: string | null;
  lastName: string | null;
  /** The original string, whitespace-normalised. Never null unless input was. */
  fullName: string | null;
}

/** "et" and "&" are here so "M. et Mme DUPONT" strips down to the surname. */
const HONORIFICS = new Set([
  "m", "mr", "mme", "mlle", "dr", "me", "pr", "monsieur", "madame",
  "mademoiselle", "maitre", "docteur", "professeur", "et", "&",
]);

/** Particles belong to the surname they precede, never to the given name. */
const PARTICLES = new Set([
  "de", "du", "des", "d", "l", "la", "le", "les", "van", "von", "der",
  "den", "da", "di", "dos", "del", "ten", "ter",
]);

/** A legal form means the buyer is an entity, so there is no first name. */
const ORGANISATIONS = new Set([
  "sarl", "sas", "sasu", "eurl", "sa", "sci", "scp", "snc", "selarl", "ste",
  "societe", "association", "asso", "ets", "etablissements", "succession",
  "indivision", "galerie",
]);

const key = (t: string) =>
  t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const isTitle = (t: string) => HONORIFICS.has(key(t).replace(/\.$/, ""));
const isParticle = (t: string) => PARTICLES.has(key(t).replace(/['’]$/, ""));
/**
 * A legal form, but only where it cannot be an ordinary name. "SARL" and
 * "Succession" are unambiguous at any casing. "SA" is not — it is also a given
 * name — so a two-letter form counts only when it is printed in caps the way a
 * legal form always is, which leaves "Sa Thi NGUYEN" with her first name.
 */
const isOrg = (t: string) => {
  const stem = key(t).replace(/\.$/, "");
  if (!ORGANISATIONS.has(stem)) return false;
  return stem.length > 2 || t === t.toLocaleUpperCase("fr-FR");
};

/**
 * Two letters minimum, so a middle initial like "D." is not mistaken for a
 * capitalised surname, and at least one cased letter so "2024" never is.
 */
const isSurnameCased = (t: string) =>
  /\p{L}\p{L}/u.test(t) &&
  t === t.toLocaleUpperCase("fr-FR") &&
  t !== t.toLocaleLowerCase("fr-FR");

export function parseFrenchName(raw: string | null | undefined): ParsedName {
  const fullName = (raw ?? "").trim().replace(/\s+/g, " ") || null;
  if (!fullName) return { firstName: null, lastName: null, fullName: null };

  let tokens = fullName.split(" ");
  while (tokens.length > 0 && isTitle(tokens[0])) tokens = tokens.slice(1);
  if (tokens.length === 0) return { firstName: null, lastName: null, fullName };

  // Only the first or last token is tested for a legal form, because that is
  // where French writes one — "SARL Brocante du Centre", "Brocante du Centre
  // SARL". Scanning the whole line instead would catch the two-letter forms
  // ("SA", "ES") inside an ordinary person's name and strip their first name
  // away on the strength of a coincidence.
  if (isOrg(tokens[0]) || isOrg(tokens[tokens.length - 1])) {
    return { firstName: null, lastName: tokens.join(" "), fullName };
  }

  // The longest run of capitalised tokens is the surname. A run rather than a
  // single token because compound surnames ("LE GALL", "DE LA TOUR") are
  // printed as separate words, and the longest one wins so a stray caps token
  // elsewhere on the line cannot outrank a real two-word surname.
  const caps = tokens.map(isSurnameCased);
  let start = -1;
  let end = -1;
  for (let i = 0, run = -1; i <= tokens.length; i++) {
    if (i < tokens.length && caps[i]) {
      if (run === -1) run = i;
      continue;
    }
    if (run === -1) continue;
    if (i - run > end - start) [start, end] = [run, i];
    run = -1;
  }

  // No capitalisation to read — either nothing is in caps or everything is.
  // Fall back to the "Given SURNAME" order the slip most often uses.
  if (start === -1 || end - start === tokens.length) {
    start = tokens.length - 1;
    end = tokens.length;
  }
  while (start > 0 && isParticle(tokens[start - 1])) start--;

  const given = [...tokens.slice(0, start), ...tokens.slice(end)].join(" ");
  return {
    firstName: given || null,
    lastName: tokens.slice(start, end).join(" ") || null,
    fullName,
  };
}
