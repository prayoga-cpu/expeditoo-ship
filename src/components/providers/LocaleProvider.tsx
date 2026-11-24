"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { NextIntlClientProvider } from "next-intl";
import {
    type Locale,
    defaultLocale,
    getInitialLocale,
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
export function LocaleProvider({ children }: LocaleProviderProps) {
    const [locale, setLocaleState] = useState<Locale>(defaultLocale);
    const [timeZone, setTimeZone] = useState(DEFAULT_TIME_ZONE);
    const [isLoading, setIsLoading] = useState(true);

    // Runs on mount because both sources — localStorage and the device
    // language — only exist on the client.
    useEffect(() => {
        setLocaleState(getInitialLocale());
        setTimeZone(browserTimeZone());
        setIsLoading(false);
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
