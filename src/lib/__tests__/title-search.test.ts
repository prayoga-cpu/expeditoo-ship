import { describe, expect, it } from "vitest";

import {
  FOLD_FROM,
  FOLD_TO,
  MAX_TITLE_WORDS,
  escapeLike,
  foldText,
  titlePatterns,
} from "../title-search";

/** board_route_search_spec.md §12 — « Titre de l'annonce ». */
describe("title search folding", () => {
  it("folds case and accents", () => {
    expect(foldText("Étagère en CHÊNE")).toBe("etagere en chene");
    expect(foldText("Canapé d'angle")).toBe("canape d'angle");
  });

  it("keeps the SQL table and the TypeScript fold in step, letter for letter", () => {
    const from = Array.from(FOLD_FROM);
    const to = Array.from(FOLD_TO);

    // `translate()` maps by position: a table one letter short shifts every
    // letter after it.
    expect(from).toHaveLength(to.length);
    expect(new Set(from).size).toBe(from.length);
    from.forEach((letter, index) => {
      expect(`${letter}→${foldText(letter)}`).toBe(`${letter}→${to[index]}`);
    });
  });

  it("covers both cases of every accented letter French uses", () => {
    for (const letter of "àâäçéèêëîïôöùûüÿÀÂÄÇÉÈÊËÎÏÔÖÙÛÜŸ") {
      expect(FOLD_FROM).toContain(letter);
    }
  });
});

describe("escapeLike", () => {
  it("neutralises the wildcards and the escape character", () => {
    expect(escapeLike("100%")).toBe("100\\%");
    expect(escapeLike("a_b")).toBe("a\\_b");
    expect(escapeLike("a\\b")).toBe("a\\\\b");
    expect(escapeLike("canape")).toBe("canape");
  });
});

describe("titlePatterns", () => {
  it("makes one contains-pattern per word, folded", () => {
    expect(titlePatterns("  Canapé  CUIR ")).toEqual(["%canape%", "%cuir%"]);
  });

  it("escapes what the person typed, so « % » matches a percent sign only", () => {
    expect(titlePatterns("100%")).toEqual(["%100\\%%"]);
    expect(titlePatterns("_")).toEqual(["%\\_%"]);
  });

  it("is empty for blank input, and bounded", () => {
    expect(titlePatterns("   ")).toEqual([]);
    expect(titlePatterns("a b c d e f g h i")).toHaveLength(MAX_TITLE_WORDS);
  });
});
