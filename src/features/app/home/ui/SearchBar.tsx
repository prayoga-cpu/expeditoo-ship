"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, SlidersHorizontal, Map } from "lucide-react";
import { useTranslations } from "next-intl";

interface SearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearchSubmit: () => void; // NEW: Trigger search
  showMap: boolean;
  onMapToggle: () => void;
  onFilterOpen: () => void;
}

/**
 * SearchBar component
 * Following rules.md:
 * - Pure UI component with no business logic
 * - All state and actions handled via props
 * - Search triggers on button click or Enter key (non-realtime)
 */

export function SearchBar({
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  showMap: _showMap,
  onMapToggle,
  onFilterOpen,
}: SearchBarProps) {
  const t = useTranslations("home.search");

  // Handle Enter key press
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      onSearchSubmit();
    }
  };

  return (
    <div className="bg-background border-b">
      <div className="mx-auto md:p-6">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder={t("placeholder")}
              className="pl-12 pr-4 md:pr-24 h-12 rounded-lg text-base"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <Button
              size="sm"
              className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 h-8"
              onClick={onSearchSubmit}
              variant="ghost"
            >
              {t("button")}
            </Button>
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-12 w-12 rounded-lg bg-transparent lg:hidden"
            onClick={onMapToggle}
          >
            <Map className="w-5 h-5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-12 w-12 rounded-lg bg-transparent"
            onClick={onFilterOpen}
          >
            <SlidersHorizontal className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
