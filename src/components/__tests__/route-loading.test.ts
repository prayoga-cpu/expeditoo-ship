import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 2.92.0 #36: a tap on the bar or the sidebar showed nothing until the next
 * route's data was ready, so it was repeated. Each shell's segment now has a
 * loading boundary at its root, which covers every page beneath that has none.
 */
const SEGMENTS = ["(main)", "carrier", "driver", "admin"];

describe("route loading boundaries", () => {
  it.each(SEGMENTS)("%s has a loading.tsx built on PageLoader", (segment) => {
    const file = join(process.cwd(), "src/app/(app)", segment, "loading.tsx");
    expect(existsSync(file)).toBe(true);
    expect(readFileSync(file, "utf8")).toContain("PageLoader");
  });
});
