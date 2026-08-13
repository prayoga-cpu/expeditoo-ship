"use client";

import { useState } from "react";
import { Globe, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    type Locale,
    locales,
    localeNames,
} from "@/i18n/config";
import { useLocale } from "@/components/providers/LocaleProvider";
import { FlagComponents } from "@/components/ui/flags";

export function FloatingLanguageSwitcher() {
    const { locale, setLocale } = useLocale();
    const [isOpen, setIsOpen] = useState(false);

    const handleLocaleChange = (newLocale: Locale) => {
        setLocale(newLocale);
        setIsOpen(false);
    };

    const CurrentFlag = FlagComponents[locale];

    return (
        <>
            {/* CSS for floating animation */}
            <style jsx>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-6px);
          }
        }
        .floating {
          animation: float 3s ease-in-out infinite;
        }
      `}</style>

            <div className="fixed bottom-6 left-6 z-50">
                {/* Language Options Popup */}
                <div
                    className={cn(
                        "absolute bottom-full left-0 mb-3 bg-card/95 backdrop-blur-md border border-border rounded-xl shadow-xl overflow-hidden transition-all duration-300 origin-bottom-left",
                        isOpen
                            ? "opacity-100 scale-100 translate-y-0"
                            : "opacity-0 scale-95 translate-y-2 pointer-events-none"
                    )}
                >
                    <div className="p-2 space-y-1">
                        {locales.map((loc) => {
                            const FlagIcon = FlagComponents[loc];
                            return (
                                <button
                                    key={loc}
                                    onClick={() => handleLocaleChange(loc)}
                                    className={cn(
                                        "flex items-center gap-3 w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                                        locale === loc
                                            ? "bg-primary text-primary-foreground"
                                            : "hover:bg-muted text-foreground"
                                    )}
                                >
                                    <FlagIcon className="w-6 h-4 rounded-sm shadow-sm" />
                                    <span className="flex-1 text-left">{localeNames[loc]}</span>
                                    {locale === loc && <Check className="w-4 h-4" />}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Floating Button */}
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={cn(
                        "floating w-14 h-14 rounded-full bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center group",
                        isOpen && "ring-2 ring-primary/50 ring-offset-2 ring-offset-background"
                    )}
                    aria-label="Change language"
                >
                    <div className="relative">
                        <Globe className="w-6 h-6 transition-transform duration-300 group-hover:scale-110" />
                        {/* Current locale indicator */}
                        <span className="absolute -top-2 -right-2 w-5 h-4 bg-background rounded-sm shadow-sm border border-border flex items-center justify-center overflow-hidden">
                            <CurrentFlag className="w-5 h-4" />
                        </span>
                    </div>
                </button>
            </div>
        </>
    );
}

