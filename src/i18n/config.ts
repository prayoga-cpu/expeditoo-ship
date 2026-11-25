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
 * The same explicit choice, as a cookie, so the SERVER can render the right
 * language on the first byte instead of French followed by a swap
 * (docs/specs/first_paint_language_spec.md). Written only when a person
 * chooses; a visitor who never did is read from `Accept-Language`.
 */
export const LOCALE_COOKIE = "expeditop-locale";

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
 * language EXPEDITOP does not ship (say "de") falls back to French, which
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
 * Best supported locale for an `Accept-Language` header — what the server
 * sees of the device before any script has run. Entries are ordered by their
 * `q` weight (ties keep the header's order), only the primary subtag is
 * compared, and an absent, empty or unsupported header is French.
 */
export function localeFromAcceptLanguage(header: string | null | undefined): Locale {
    if (!header) return defaultLocale;

    const ranked = header
        .split(",")
        .map((part, index) => {
            const [tag, ...params] = part.trim().split(";");
            const q = params
                .map((param) => param.trim().match(/^q=(.*)$/i)?.[1])
                .find(Boolean);
            const weight = q === undefined ? 1 : Number.parseFloat(q);
            return { tag: tag.trim(), weight: Number.isNaN(weight) ? 0 : weight, index };
        })
        .filter((entry) => entry.tag && entry.tag !== "*" && entry.weight > 0)
        .sort((a, b) => b.weight - a.weight || a.index - b.index);

    for (const { tag } of ranked) {
        const primary = tag.split("-")[0]?.toLowerCase();
        if (primary && isValidLocale(primary)) return primary;
    }
    return defaultLocale;
}

/**
 * The locale a request is to be rendered in: the person's own choice (cookie)
 * wins, then the device's language, then French.
 */
export function resolveRequestLocale(
    cookie: string | null | undefined,
    acceptLanguage: string | null | undefined
): Locale {
    if (cookie && isValidLocale(cookie)) return cookie;
    return localeFromAcceptLanguage(acceptLanguage);
}

/** The cookie's value in this browser, if a choice was ever made. */
export function readLocaleCookie(): Locale | null {
    if (typeof document === "undefined") return null;
    const match = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`));
    const value = match?.[1];
    return value && isValidLocale(value) ? value : null;
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

    const stored = readStoredLocale();
    if (stored) return stored;
    return detectDeviceLocale();
}

/** The choice kept in this browser, or null. Storage can throw (private mode). */
export function readStoredLocale(): Locale | null {
    if (typeof window === "undefined") return null;
    try {
        const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
        return stored && isValidLocale(stored) ? stored : null;
    } catch {
        return null;
    }
}

/**
 * Remember an explicit choice: in storage, and in the cookie the server reads
 * on the next request so the page is rendered in this language from the first
 * byte.
 */
export function setStoredLocale(locale: Locale): void {
    if (typeof window === "undefined") return;
    try {
        localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    } catch {
        // The cookie below still carries the choice.
    }
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
}
