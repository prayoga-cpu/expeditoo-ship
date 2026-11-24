/**
 * How the landing page shows text a requester typed, on a public card
 * (landing_2026_11_spec.md §4.4). Only casing, and only when the casing says
 * nothing: « MARSEILLE » and « bayonne » are shown as names; « Saint-Malo »,
 * typed with care, is left exactly as it is.
 */

/** The little words a French place name keeps in lower case after a hyphen. */
const PARTICLES = new Set(["de", "des", "du", "en", "et", "la", "le", "les", "lès", "sous", "sur", "aux", "au"]);

function isUniform(text: string, locale: string) {
  return text === text.toLocaleUpperCase(locale) || text === text.toLocaleLowerCase(locale);
}

/** A town in all capitals or all lower case, as a name: « AIX-EN-PROVENCE » → « Aix-en-Provence ». */
export function townAsName(text: string, locale: string): string {
  if (!isUniform(text, locale)) return text;
  const lower = text.toLocaleLowerCase(locale);
  return lower.replace(/(^|[\s\-'’])(\p{L}+)/gu, (match, sep: string, word: string, offset: number) => {
    if (offset > 0 && sep === "-" && PARTICLES.has(word)) return match;
    return sep + word.charAt(0).toLocaleUpperCase(locale) + word.slice(1);
  });
}

/** A title with a capital first letter; one typed all in capitals, as a sentence. */
export function titleAsSentence(text: string, locale: string): string {
  const base = text === text.toLocaleUpperCase(locale) ? text.toLocaleLowerCase(locale) : text;
  return base.charAt(0).toLocaleUpperCase(locale) + base.slice(1);
}
