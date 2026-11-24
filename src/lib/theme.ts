/**
 * The app's two looks, and how they are declared to the browser (2.96.0 #29).
 *
 * Colours change only when the person picks Dark inside the app — never
 * because the phone, the computer or the browser is in dark mode. There is no
 * "follow my device" choice any more: on a client's iPhone it turned messages
 * and the bottom bar's pill unreadable, and nobody had chosen it.
 *
 * The browser is told the same thing in two places, so that no forced-dark
 * feature repaints the page on its own:
 *
 * - CSS: `color-scheme: only light` on `:root`, `dark` under `.dark`
 *   (globals.css). This is what decides once the stylesheet is in.
 * - `<meta name="color-scheme">`: `only light` in the server HTML (the root
 *   layout's `viewport`), kept in step by `syncColorSchemeMeta` when Dark is
 *   chosen. It covers the moment before the stylesheet applies.
 *
 * `only` is the word that matters. Chrome's Auto Dark Theme (Android's
 * « Thème sombre automatique pour le contenu Web », desktop
 * `#enable-force-dark`) darkens a page that says `light` or nothing, and
 * leaves alone one that says `only light`
 * (https://developer.chrome.com/blog/auto-dark-theme). `next-themes`'
 * `enableColorScheme` would write a plain `color-scheme: light` inline on
 * `<html>` — inline beats the stylesheet, so it would undo the opt-out — which
 * is why Providers turns it off and this module owns the declaration.
 */

export const THEME_STORAGE_KEY = "theme";

export const APP_THEMES = ["light", "dark"] as const;
export type AppTheme = (typeof APP_THEMES)[number];

/** What a first visit gets, and what anything unrecognised falls back to. */
export const DEFAULT_THEME: AppTheme = "light";

export function isAppTheme(value: unknown): value is AppTheme {
  return value === "light" || value === "dark";
}

/** Light unless Dark was chosen — `undefined` (server, first render) included. */
export function appThemeOf(value: string | null | undefined): AppTheme {
  return value === "dark" ? "dark" : "light";
}

/** The `color-scheme` the browser is told for a theme. */
export function colorSchemeFor(theme: string | null | undefined): "only light" | "dark" {
  return appThemeOf(theme) === "dark" ? "dark" : "only light";
}

/**
 * A stored `system` (or anything else the app no longer offers) becomes
 * `light`, once and silently. Runs before `next-themes` reads storage, so the
 * provider never starts on a choice its controls cannot show.
 *
 * Never throws: storage can be blocked, and the page must still render.
 */
export function migrateStoredTheme(storage: Pick<Storage, "getItem" | "setItem"> | undefined = safeStorage()): void {
  if (!storage) return;
  try {
    const stored = storage.getItem(THEME_STORAGE_KEY);
    if (stored !== null && !isAppTheme(stored)) {
      storage.setItem(THEME_STORAGE_KEY, DEFAULT_THEME);
      // next-themes' inline script has already stamped the old value on
      // <html> as a class; it only ever removes the themes it knows.
      if (typeof document !== "undefined") document.documentElement.classList.remove(stored);
    }
  } catch {
    // Blocked storage: next-themes falls back to the default, which is light.
  }
}

function safeStorage(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

/** Keeps `<meta name="color-scheme">` saying what the page is drawn in. */
export function syncColorSchemeMeta(theme: string | null | undefined, doc: Document = document): void {
  let meta = doc.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
  if (!meta) {
    meta = doc.createElement("meta");
    meta.name = "color-scheme";
    doc.head.appendChild(meta);
  }
  const content = colorSchemeFor(theme);
  if (meta.content !== content) meta.content = content;
}
