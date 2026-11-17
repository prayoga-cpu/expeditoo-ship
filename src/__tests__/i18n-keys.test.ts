import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

import en from "../../messages/en.json";
import fr from "../../messages/fr.json";

/**
 * A key a screen asks for and a message file does not hold renders as the raw
 * key — « jobBoard.modeNotice » where a sentence belongs — and nothing fails:
 * next-intl logs once in the console. That is how five notices on the job board
 * shipped filed under `marketing.jobBoard` (the wrong « jobBoard » object) and
 * read as code to every driver (2.88.0).
 *
 * This reads the source the way `no-dead-ends.test.ts` does: every
 * `const t = useTranslations("ns")` / `getTranslations("ns")`, then every
 * `t("key")` (also `.rich`, `.raw`, `.has`) after it, resolved against BOTH
 * languages. A key built with `${…}` is checked only up to its static prefix.
 */

const SRC = join(__dirname, "..");

type Tree = { [key: string]: string | Tree };

// The JSON also holds arrays (lists of steps); indexing them by position works
// the same way, so they are read as the trees they behave like.
const EN = en as unknown as Tree;
const FR = fr as unknown as Tree;

function has(tree: Tree, path: string): boolean {
  let node: string | Tree = tree;
  for (const part of path.split(".").filter(Boolean)) {
    if (typeof node === "string" || !(part in node)) return false;
    node = node[part];
  }
  return true;
}

function leaves(tree: Tree, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([key, value]) =>
    typeof value === "string" ? [prefix + key] : leaves(value, `${prefix}${key}.`)
  );
}

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return name === "__tests__" || name === "node_modules" ? [] : sources(path);
    }
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

const DECLARATION =
  /(?:const|let)\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*(?:\{\s*namespace:\s*)?(?:"([^"]*)"|'([^']*)')?\s*\}?\s*\)/g;

interface Use {
  where: string;
  key: string;
  dynamic: boolean;
}

function uses(): Use[] {
  const found: Use[] = [];
  for (const file of sources(SRC)) {
    const text = readFileSync(file, "utf8");
    const declarations = [...text.matchAll(DECLARATION)].map((m) => ({
      at: m.index ?? 0,
      name: m[1],
      namespace: m[2] ?? m[3] ?? "",
    }));
    for (const name of new Set(declarations.map((d) => d.name))) {
      const call = new RegExp(
        `(?<![\\w.])${name}(?:\\.rich|\\.raw|\\.has)?\\(\\s*(["'\`])([^"'\`]*?)\\1`,
        "g"
      );
      for (const m of text.matchAll(call)) {
        const at = m.index ?? 0;
        // The nearest declaration above: one file often holds several
        // components, each with its own namespace under the same name.
        const owner = declarations.filter((d) => d.name === name && d.at < at).pop();
        if (!owner) continue;
        const raw = m[2];
        const dynamic = raw.includes("${");
        const key = dynamic ? raw.split("${")[0].replace(/\.$/, "") : raw;
        const line = text.slice(0, at).split("\n").length;
        found.push({
          where: `${relative(SRC, file)}:${line}`,
          key: [owner.namespace, key].filter(Boolean).join("."),
          dynamic,
        });
      }
    }
  }
  return found;
}

describe("translation keys", () => {
  const all = uses();

  it("finds the keys it is meant to audit", () => {
    // Guards the reader itself: a regexp that silently matched nothing would
    // turn every check below into a pass.
    expect(all.length).toBeGreaterThan(1000);
  });

  it.each([
    ["en", EN],
    ["fr", FR],
  ])("every key a screen asks for exists in %s", (_lang, messages) => {
    const missing = all
      .filter((use) => (use.dynamic ? use.key !== "" : true))
      .filter((use) => !has(messages, use.key))
      .map((use) => `${use.key}  ←  ${use.where}`);

    expect(missing).toEqual([]);
  });

  it("holds exactly the same keys in French and English", () => {
    const english = new Set(leaves(EN));
    const french = new Set(leaves(FR));

    expect([...english].filter((key) => !french.has(key))).toEqual([]);
    expect([...french].filter((key) => !english.has(key))).toEqual([]);
  });

  it("has no empty message", () => {
    const empty = (messages: Tree, lang: string) =>
      leaves(messages)
        .filter((key) => {
          let node: string | Tree = messages;
          for (const part of key.split(".")) node = (node as Tree)[part];
          return node === "";
        })
        .map((key) => `${lang}: ${key}`);

    expect([...empty(EN, "en"), ...empty(FR, "fr")]).toEqual([]);
  });
});
