import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * client_feedback_2026_10_spec.md §10. The bottom bars were a fixed 88px with
 * the iOS safe-area inset as padding *inside* that height, so on an iPad the
 * home indicator cut the labels off. Each bar is now 88px *plus* the inset,
 * and each shell pads its scroller by the same amount. jsdom has no
 * `env(safe-area-inset-bottom)`, so this pins the classes rather than a layout.
 */

// The bars are floating capsules now (FloatingNav.tsx): they sit 12px above the
// inset, and the shells keep reserving 88px + inset, which covers capsule + gap.
const FLOAT_GAP = "pb-[calc(12px_+_env(safe-area-inset-bottom))]";
const SHELL_PADDING = "pb-[calc(88px_+_env(safe-area-inset-bottom))]";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const BARS = [
  "src/components/BottomNav.tsx",
  "src/features/app/driver/ui/DriverBottomNav.tsx",
  "src/features/app/admin/ui/AdminBottomNav.tsx",
];

const SHELLS = [
  "src/components/layouts/MainLayout.tsx",
  "src/features/app/driver/ui/DriverLayout.tsx",
  "src/features/app/admin/ui/AdminLayout.tsx",
];

describe("bottom bars and the iOS safe area", () => {
  it("the floating capsule lifts itself above the inset", () => {
    expect(read("src/components/layouts/FloatingNav.tsx")).toContain(FLOAT_GAP);
  });

  it.each(BARS)("%s is drawn by the shared floating capsule", (path) => {
    expect(read(path)).toMatch(/FloatingNav|FLOATING_NAV_OUTER/);
  });

  it.each(SHELLS)("%s pads its scroller by the same height", (path) => {
    const source = read(path);
    expect(source).toContain(SHELL_PADDING);
    expect(source).not.toContain("pb-[88px]");
  });
});
