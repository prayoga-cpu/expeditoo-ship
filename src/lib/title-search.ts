/**
 * Matching what a person typed against a job's title, case and accents aside
 * (board_route_search_spec.md §12: « Titre de l'annonce »).
 *
 * The same folding exists twice, once here and once in SQL: Postgres has no
 * `unaccent` on this database (an extension is a migration), so the board's
 * query folds the column with `translate()` over the two strings below. A
 * test holds the two copies together — every letter in `FOLD_FROM` must fold,
 * in TypeScript, to the letter at the same index of `FOLD_TO`.
 *
 * Upper-case letters are listed too. `lower()` handles them on a UTF-8
 * locale and silently leaves them alone on the `C` one, and « ÉTAGÈRE » not
 * finding « étagère » would depend on how the database was created.
 */

const LOWER_FROM = "àáâãäåçèéêëìíîïñòóôõöùúûüýÿ";
const LOWER_TO = "aaaaaaceeeeiiiinooooouuuuyy";

/** Every accented letter the SQL side folds, and what each becomes. */
export const FOLD_FROM = LOWER_FROM + LOWER_FROM.toUpperCase();
export const FOLD_TO = LOWER_TO + LOWER_TO;

/** How many words of a search are read; the rest are dropped, not refused. */
export const MAX_TITLE_WORDS = 6;

/** Lower-case, without accents. « Étagère » → « etagere ». */
export function foldText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

/**
 * `%`, `_` and the escape character itself, neutralised for a `LIKE … ESCAPE
 * '\'`. Without it « 100% » matches every title and « _ » any character.
 */
export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/**
 * The `LIKE` patterns a typed title becomes: one per word, each of which the
 * title must contain — so « cuir canapé » finds « Canapé en cuir ».
 */
export function titlePatterns(query: string): string[] {
  return foldText(query)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, MAX_TITLE_WORDS)
    .map((word) => `%${escapeLike(word)}%`);
}
