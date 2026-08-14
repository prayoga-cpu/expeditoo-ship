/**
 * Internationalization Configuration
 * Defines supported locales and default settings
 */

export const locales = ["fr", "en"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "fr";

export const localeNames: Record<Locale, string> = {
    fr: "Français",
    en: "English",
};

export const localeFlags: Record<Locale, string> = {
    fr: "🇫🇷",
    en: "🇬🇧",
};

export const LOCALE_STORAGE_KEY = "expeditoo-locale";

/**
 * Check if a string is a valid locale
 */
export function isValidLocale(locale: string): locale is Locale {
    return locales.includes(locale as Locale);
}

/**
 * Best supported locale for the device.
 *
 * `navigator.languages` is ordered by the user's preference, so the first
 * entry we actually ship wins. Only the primary subtag is compared, so
 * "en-GB", "en-US" and "en" all resolve to "en". A device asking for a
 * language EXPEDITOO does not ship (say "de") falls back to French, which
 * stays the product default.
 */
export function detectDeviceLocale(): Locale {
    if (typeof navigator === "undefined") return defaultLocale;

    const preferences = navigator.languages?.length
        ? navigator.languages
        : [navigator.language];

    for (const preference of preferences) {
        const primary = preference?.split("-")[0]?.toLowerCase();
        if (primary && isValidLocale(primary)) return primary;
    }

    return defaultLocale;
}

/**
 * Locale to open the app in: an explicit choice if the user has made one,
 * otherwise whatever the device asks for.
 *
 * Only ever call this on the client — on the server there is no device to
 * read, so it reports the default and the client corrects it on mount.
 */
export function getInitialLocale(): Locale {
    if (typeof window === "undefined") return defaultLocale;

    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored && isValidLocale(stored)) {
        return stored;
    }
    return detectDeviceLocale();
}

/**
 * Save locale to localStorage
 */
export function setStoredLocale(locale: Locale): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
}
