import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Larger text on phones and tablets (client feedback 2026-11-19, #28 and #4):
 * below `lg` the root font size is 17px, so every rem-based size grows
 * together. jsdom applies no media query, so this pins the source — the rule,
 * where it sits, and the two things that must move with it.
 */

const ROOT = process.cwd();
const css = readFileSync(join(ROOT, "src/app/globals.css"), "utf8");

/** The body of the first `{ … }` block opening at or after `from`. */
function blockAfter(text: string, from: number): string {
  const open = text.indexOf("{", from);
  let depth = 0;
  for (let at = open; at < text.length; at++) {
    if (text[at] === "{") depth++;
    if (text[at] === "}" && --depth === 0) return text.slice(open + 1, at);
  }
  return "";
}

const BELOW_LG = "@media not all and (min-width: 64rem)";

describe("the root font size", () => {
  const base = blockAfter(css, css.indexOf("@layer base"));

  it("is 17px below lg, in the base layer", () => {
    const at = base.indexOf(BELOW_LG);
    expect(at).toBeGreaterThan(-1);

    const media = blockAfter(base, at);
    expect(media.replace(/\s+/g, " ").trim()).toBe("html { font-size: 106.25%; }");
    // 106.25% of the browser's 16px.
    expect(16 * 1.0625).toBe(17);
  });

  it("is set nowhere else, so it stays 100% from lg", () => {
    const rootSizes = css.match(/(?:html|:root)\s*\{[^}]*font-size:[^;]+;/g) ?? [];
    expect(rootSizes).toHaveLength(1);
  });

  it("uses a query iOS Safari 15 understands, not range syntax", () => {
    expect(css).not.toMatch(/@media[^{]*\(\s*width\s*[<>]/);
  });

  it("cites the feedback it answers", () => {
    const comment = base.slice(0, base.indexOf(BELOW_LG));
    expect(comment).toContain("2026-11-19");
    expect(comment).toContain("#28");
  });
});

describe("what must move with the root size", () => {
  it("grows the bottom bar's reserve with the bar", () => {
    // The bar is sized in rem; the shells reserve a fixed 88px for it.
    const start = css.lastIndexOf(BELOW_LG);
    expect(start).toBeGreaterThan(css.indexOf("@layer base"));

    const rules = blockAfter(css, start).replace(/\s+/g, " ");
    expect(rules).toContain(
      ".pb-\\[calc\\(88px_\\+_env\\(safe-area-inset-bottom\\)\\)\\] { padding-bottom: calc(5.5rem + env(safe-area-inset-bottom)); }"
    );
    expect(rules).toContain(
      ".bottom-\\[calc\\(88px_\\+_env\\(safe-area-inset-bottom\\)\\)\\] { bottom: calc(5.5rem + env(safe-area-inset-bottom)); }"
    );
    // 5.5rem is the same 88px at a 16px root.
    expect(5.5 * 16).toBe(88);
  });

  it("keeps the class the reserve rule is written against in the shells", () => {
    for (const path of [
      "src/components/layouts/MainLayout.tsx",
      "src/features/app/driver/ui/DriverLayout.tsx",
      "src/features/app/admin/ui/AdminLayout.tsx",
    ]) {
      expect(readFileSync(join(ROOT, path), "utf8")).toContain(
        "pb-[calc(88px_+_env(safe-area-inset-bottom))]"
      );
    }
  });

  it.each(["src/features/app/messages", "src/features/app/home", "src/app/(auth)/signup"])(
    "%s has no text sized in fixed pixels",
    (dir) => {
      const files = (at: string): string[] =>
        readdirSync(at).flatMap((name) => {
          const path = join(at, name);
          if (statSync(path).isDirectory()) return name === "__tests__" ? [] : files(path);
          return /\.tsx?$/.test(name) ? [path] : [];
        });

      const fixed = files(join(ROOT, dir)).flatMap((file) =>
        (readFileSync(file, "utf8").match(/text-\[\d+px\]/g) ?? []).map(
          (size) => `${relative(ROOT, file)}: ${size}`
        )
      );
      expect(fixed).toEqual([]);
    }
  );
});
