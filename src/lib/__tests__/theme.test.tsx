import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import en from "../../../messages/en.json";
import {
  APP_THEMES,
  colorSchemeFor,
  migrateStoredTheme,
  syncColorSchemeMeta,
  THEME_STORAGE_KEY,
} from "../theme";

/**
 * 2.96.0 #29. A client's iPhone in dark mode showed coloured, unreadable
 * messages and a black pill in the bottom bar: the app followed the device.
 * It now follows only its own toggle, and says so to the browser in words
 * forced-dark features respect (`only light`).
 */

const ROOT = join(__dirname, "../../..");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

beforeEach(() => {
  // next-themes subscribes to the media query even with System off; jsdom has none.
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
  window.localStorage.clear();
  document.head.querySelectorAll('meta[name="color-scheme"]').forEach((m) => m.remove());
  document.documentElement.className = "";
  document.documentElement.removeAttribute("style");
});

describe("the two themes", () => {
  it("are light and dark, with nothing that follows the device", () => {
    expect([...APP_THEMES]).toEqual(["light", "dark"]);
  });

  it("declare `only light` unless Dark is chosen", () => {
    expect(colorSchemeFor("light")).toBe("only light");
    expect(colorSchemeFor(undefined)).toBe("only light");
    expect(colorSchemeFor("system")).toBe("only light");
    expect(colorSchemeFor("dark")).toBe("dark");
  });
});

describe("migrateStoredTheme", () => {
  it("turns a stored `system` into `light`, once", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "system");
    // next-themes' inline script stamps the stored value on <html> first.
    document.documentElement.classList.add("system");
    migrateStoredTheme();
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
    expect(document.documentElement.classList.contains("system")).toBe(false);
  });

  it("keeps a chosen Dark and writes nothing for a first visit", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
    migrateStoredTheme();
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");

    window.localStorage.clear();
    migrateStoredTheme();
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });

  it("never throws when storage is blocked", () => {
    const blocked = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("SecurityError");
      },
    };
    expect(() => migrateStoredTheme(blocked)).not.toThrow();
  });
});

describe("syncColorSchemeMeta", () => {
  it("creates the tag if the page has none, and follows the theme", () => {
    syncColorSchemeMeta("dark");
    const meta = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
    expect(meta?.content).toBe("dark");

    syncColorSchemeMeta("light");
    expect(document.querySelectorAll('meta[name="color-scheme"]')).toHaveLength(1);
    expect(meta?.content).toBe("only light");
  });
});

describe("ThemeProvider as Providers configures it", () => {
  afterEach(() => {
    vi.resetModules();
  });

  async function mountProvider() {
    // Imported after storage is set: the migration runs when the module loads,
    // before next-themes reads storage — as it does in the browser.
    const { ThemeProvider } = await import("@/components/ThemeProvider");
    const { useTheme } = await import("next-themes");
    const seen: { theme?: string; setTheme?: (theme: string) => void } = {};
    function Probe() {
      const { theme, setTheme } = useTheme();
      seen.theme = theme;
      seen.setTheme = setTheme;
      return null;
    }
    render(
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        themes={[...APP_THEMES]}
        enableSystem={false}
        enableColorScheme={false}
        storageKey={THEME_STORAGE_KEY}
      >
        <Probe />
      </ThemeProvider>
    );
    return seen;
  }

  it("starts a stored `system` on light, silently", async () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "system");
    const seen = await mountProvider();
    expect(seen.theme).toBe("light");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("keeps the meta tag in step on toggle, and never writes an inline color-scheme", async () => {
    const seen = await mountProvider();
    const meta = () => document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
    expect(meta()?.content).toBe("only light");

    act(() => seen.setTheme?.("dark"));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(meta()?.content).toBe("dark");

    act(() => seen.setTheme?.("light"));
    expect(meta()?.content).toBe("only light");
    // An inline `color-scheme: light` would outrank globals.css's `only light`.
    expect(document.documentElement.style.colorScheme).toBe("");
  });

  it("is what Providers actually passes", () => {
    const source = read("src/components/providers/Providers.tsx");
    expect(source).toMatch(/enableSystem=\{false\}/);
    expect(source).toMatch(/enableColorScheme=\{false\}/);
    expect(source).not.toMatch(/\benableSystem\s*\n/);
  });
});

describe("what the browser is told", () => {
  it("globals.css declares `only light` on :root and `dark` under .dark", () => {
    const css = read("src/app/globals.css");
    const root = css.slice(css.indexOf(":root {"), css.indexOf("}", css.indexOf(":root {")));
    expect(root).toMatch(/color-scheme:\s*only light;/);
    const dark = css.slice(css.indexOf("\n.dark {"), css.indexOf("}", css.indexOf("\n.dark {")));
    expect(dark).toMatch(/color-scheme:\s*dark;/);
  });

  it("the root layout ships the meta tag as `only light`", () => {
    expect(read("src/app/layout.tsx")).toMatch(/colorScheme:\s*"only light"/);
  });

  it("nothing in the app reads the device's preference", () => {
    // The vendor files are not ours; this is every stylesheet and component.
    const offenders = ["src/app/globals.css", "src/components/ui/sonner.tsx"].filter((file) =>
      /@media[^{]*prefers-color-scheme|matchMedia\(\s*["']\(prefers-color-scheme|=\s*["']system["']/.test(
        read(file)
      )
    );
    expect(offenders).toEqual([]);
  });
});

describe("theme controls offer Light and Dark only", () => {
  it("the header's toggle", async () => {
    vi.resetModules();
    // One module registry for the toggle and its providers, or their
    // contexts would not be the same objects.
    const { ThemeToggle } = await import("@/components/ui/theme-toggle");
    const { ThemeProvider } = await import("next-themes");
    const { NextIntlClientProvider } = await import("next-intl");
    render(
      <ThemeProvider attribute="class" enableSystem={false} defaultTheme="light">
        <NextIntlClientProvider locale="en" messages={en}>
          <ThemeToggle />
        </NextIntlClientProvider>
      </ThemeProvider>
    );
    const trigger = await screen.findByRole("button", { name: en.common.theme.toggle });
    fireEvent.keyDown(trigger, { key: "Enter" });
    const items = await screen.findAllByRole("menuitem");
    expect(items.map((item) => item.textContent?.replace("✓", "").trim())).toEqual([
      en.common.theme.light,
      en.common.theme.dark,
    ]);
  });

  it("no theme list in the app shells or settings carries `system`", () => {
    for (const file of [
      "src/components/layouts/HeaderToolbox.tsx",
      "src/components/ui/theme-toggle.tsx",
      "src/features/app/profile/ui/Settings.tsx",
    ]) {
      expect(read(file), file).not.toMatch(/["']system["']/);
    }
  });
});
