"use client";

import { useState, useEffect } from "react";
import { History, TrendingUp, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

const RECENT_SEARCHES_KEY = "expeditoo_recent_searches";
const MAX_RECENT_SEARCHES = 5;

// Mock popular searches (would come from API in real implementation)
const popularSearches = [
    "vintage furniture",
    "electronics",
    "antique lamp",
    "leather bag",
    "art prints",
];

interface SearchSuggestionsProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (query: string) => void;
    searchQuery: string;
}

export function SearchSuggestions({
    isOpen,
    onClose,
    onSelect,
    searchQuery,
}: SearchSuggestionsProps) {
    const t = useTranslations("home.search");
    const [recentSearches, setRecentSearches] = useState<string[]>([]);

    // Load recent searches from localStorage
    useEffect(() => {
        const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
        if (stored) {
            setRecentSearches(JSON.parse(stored));
        }
    }, []);

    // Filter suggestions based on current query
    const filteredRecent = searchQuery
        ? recentSearches.filter((s) =>
            s.toLowerCase().includes(searchQuery.toLowerCase())
        )
        : recentSearches;

    const filteredPopular = searchQuery
        ? popularSearches.filter((s) =>
            s.toLowerCase().includes(searchQuery.toLowerCase())
        )
        : popularSearches;

    const handleSelect = (query: string) => {
        // Add to recent searches
        const updated = [query, ...recentSearches.filter((s) => s !== query)].slice(
            0,
            MAX_RECENT_SEARCHES
        );
        setRecentSearches(updated);
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));

        onSelect(query);
        onClose();
    };

    const clearRecentSearches = () => {
        setRecentSearches([]);
        localStorage.removeItem(RECENT_SEARCHES_KEY);
    };

    if (!isOpen) return null;

    return (
        <div className="absolute top-full left-0 right-0 mt-2 bg-popover border border-border rounded-lg shadow-xl z-50 overflow-hidden">
            {/* Recent Searches */}
            {filteredRecent.length > 0 && (
                <div className="p-3 border-b border-border">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                            <History className="w-3 h-3" />
                            {t("recentSearches")}
                        </span>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs text-muted-foreground hover:text-destructive"
                            onClick={clearRecentSearches}
                        >
                            <X className="w-3 h-3 mr-1" />
                            {t("clearRecent")}
                        </Button>
                    </div>
                    <div className="space-y-1">
                        {filteredRecent.map((query) => (
                            <button
                                key={query}
                                onClick={() => handleSelect(query)}
                                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted text-left text-sm transition-colors"
                            >
                                <Search className="w-4 h-4 text-muted-foreground" />
                                <span>{query}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Popular Searches */}
            {filteredPopular.length > 0 && (
                <div className="p-3">
                    <span className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-2">
                        <TrendingUp className="w-3 h-3" />
                        {t("popularSearches")}
                    </span>
                    <div className="flex flex-wrap gap-2">
                        {filteredPopular.slice(0, 5).map((query) => (
                            <button
                                key={query}
                                onClick={() => handleSelect(query)}
                                className="px-3 py-1 rounded-full bg-muted hover:bg-muted/80 text-sm transition-colors"
                            >
                                {query}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* No results */}
            {filteredRecent.length === 0 && filteredPopular.length === 0 && (
                <div className="p-4 text-center text-sm text-muted-foreground">
                    {t("noSuggestions")}
                </div>
            )}
        </div>
    );
}

// Helper to save a search when user submits
export function saveRecentSearch(query: string) {
    if (!query.trim()) return;

    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    const recent = stored ? JSON.parse(stored) : [];
    const updated = [query.trim(), ...recent.filter((s: string) => s !== query.trim())].slice(
        0,
        MAX_RECENT_SEARCHES
    );
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
}
