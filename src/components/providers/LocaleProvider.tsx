"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { NextIntlClientProvider } from "next-intl";
import {
    type Locale,
    defaultLocale,
    getStoredLocale,
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

interface LocaleContextType {
    locale: Locale;
    setLocale: (locale: Locale) => void;
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

export function LocaleProvider({ children }: LocaleProviderProps) {
    const [locale, setLocaleState] = useState<Locale>(defaultLocale);
    const [isLoading, setIsLoading] = useState(true);

    // Initialize locale from localStorage
    useEffect(() => {
        const storedLocale = getStoredLocale();
        setLocaleState(storedLocale);
        setIsLoading(false);
    }, []);

    // Change locale
    const setLocale = useCallback((newLocale: Locale) => {
        if (!isValidLocale(newLocale)) {
            console.error(`Invalid locale: ${newLocale}`);
            return;
        }

        setStoredLocale(newLocale);
        setLocaleState(newLocale);
    }, []);

    // Get messages for current locale
    const messages = messagesMap[locale];

    // Show loading state while initializing
    if (isLoading) {
        return (
            <LocaleContext.Provider value={{ locale, setLocale, isLoading: true }}>
                {children}
            </LocaleContext.Provider>
        );
    }

    return (
        <LocaleContext.Provider value={{ locale, setLocale, isLoading }}>
            <NextIntlClientProvider locale={locale} messages={messages}>
                {children}
            </NextIntlClientProvider>
        </LocaleContext.Provider>
    );
}
