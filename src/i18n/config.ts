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
 * Get locale from localStorage with fallback
 */
export function getStoredLocale(): Locale {
    if (typeof window === "undefined") return defaultLocale;

    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored && isValidLocale(stored)) {
        return stored;
    }
    return defaultLocale;
}

/**
 * Save locale to localStorage
 */
export function setStoredLocale(locale: Locale): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
}
