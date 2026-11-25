"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { NextIntlClientProvider } from "next-intl";
import {
    type Locale,
    defaultLocale,
    detectDeviceLocale,
    readLocaleCookie,
    readStoredLocale,
    setStoredLocale,
    isValidLocale,
} from "@/i18n/config";

// Static imports for translation files (Turbopack requires static imports)
import frMessages from "../../../messages/fr.json";
import enMessages from "../../../messages/en.json";

// Type for messages
type Messages = typeof frMessages;

// Map of locale to messages
const messagesMap: Record<Locale, Messages> = {
    fr: frMessages,
    en: enMessages,
};

/**
 * The zone dates are written in until the browser's own is known: the
 * product's, and the one the server has to assume. The server cannot read the
 * visitor's zone, so rendering with it on the first pass would make every
 * formatted time disagree between the server's HTML and hydration.
 */
export const DEFAULT_TIME_ZONE = "Europe/Paris";

function browserTimeZone(): string {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIME_ZONE;
    } catch {
        return DEFAULT_TIME_ZONE;
    }
}

interface LocaleContextType {
    locale: Locale;
    setLocale: (locale: Locale) => void;
    /** True until the stored or device locale has been read (first paint, and
     * the server). The page is already rendered — in `defaultLocale`. */
    isLoading: boolean;
}

const LocaleContext = createContext<LocaleContextType | undefined>(undefined);

export function useLocale() {
    const context = useContext(LocaleContext);
    if (!context) {
        throw new Error("useLocale must be used within a LocaleProvider");
    }
    return context;
}

interface LocaleProviderProps {
    children: React.ReactNode;
    /**
     * The language the server rendered this request in (cookie, else
     * `Accept-Language`, else French). The first client render uses it too, so
     * hydration matches and a visitor never sees another language first.
     */
    initialLocale?: Locale;
}

/**
 * One tree, from the server's HTML to the last locale switch (2.96.0 #36).
 *
 * This used to render `children` bare while the locale was being read and
 * wrap them in `NextIntlClientProvider` once it was. Changing the element at
 * the root of the app made React throw the whole tree away and mount it again
 * right after the first paint — a tap on the bar in that window landed on a
 * node that no longer existed, and every piece of state started over — and,
 * because the server never got past the bare branch, every route shipped an
 * empty page (`useTranslations` had no provider to read).
 *
 * Now the provider is always there. The server and the first client render
 * use `defaultLocale` and `DEFAULT_TIME_ZONE`, so hydration matches; the
 * effect then swaps in the stored or device locale and the browser's zone as
 * new props on the same element. React re-renders the text in place — nothing
 * below is unmounted.
 */
export function LocaleProvider({ children, initialLocale = defaultLocale }: LocaleProviderProps) {
    const [locale, setLocaleState] = useState<Locale>(initialLocale);
    const [timeZone, setTimeZone] = useState(DEFAULT_TIME_ZONE);
    const [isLoading, setIsLoading] = useState(true);

    // Runs on mount because the browser's own state only exists on the client.
    // The server has already answered from the cookie or the device's
    // `Accept-Language`, so this only corrects what it could not know:
    //  - a choice kept in localStorage before the cookie existed (it is copied
    //    to the cookie, once, so the next request needs no correction);
    //  - a request with no header at all (a bot, a proxy), read from the
    //    device instead.
    useEffect(() => {
        const stored = readStoredLocale();
        if (stored && readLocaleCookie() !== stored) setStoredLocale(stored);
        setLocaleState(stored ?? (readLocaleCookie() ? initialLocale : detectDeviceLocale()));
        setTimeZone(browserTimeZone());
        setIsLoading(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on mount
    }, []);

    // Keep <html lang> in step with what is actually rendered. The server can
    // only guess (it stamps `defaultLocale`), so on an English device the
    // document would otherwise claim to be French for the rest of the session.
    useEffect(() => {
        document.documentElement.lang = locale;
    }, [locale]);

    // Change locale
    const setLocale = useCallback((newLocale: Locale) => {
        if (!isValidLocale(newLocale)) {
            console.error(`Invalid locale: ${newLocale}`);
            return;
        }

        setStoredLocale(newLocale);
        setLocaleState(newLocale);
    }, []);

    const context = useMemo(
        () => ({ locale, setLocale, isLoading }),
        [locale, setLocale, isLoading]
    );

    return (
        <LocaleContext.Provider value={context}>
            <NextIntlClientProvider
                locale={locale}
                messages={messagesMap[locale]}
                timeZone={timeZone}
            >
                {children}
            </NextIntlClientProvider>
        </LocaleContext.Provider>
    );
}
