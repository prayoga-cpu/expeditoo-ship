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

const BAR_HEIGHT = "h-[calc(88px_+_env(safe-area-inset-bottom))]";
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
  it.each(BARS)("%s is 88px tall above the inset, with the inset as padding", (path) => {
    const source = read(path);
    expect(source).toContain(BAR_HEIGHT);
    expect(source).toContain("pb-[env(safe-area-inset-bottom)]");
    expect(source).not.toContain("h-[88px]");
  });

  it.each(SHELLS)("%s pads its scroller by the same height", (path) => {
    const source = read(path);
    expect(source).toContain(SHELL_PADDING);
    expect(source).not.toContain("pb-[88px]");
  });
});
