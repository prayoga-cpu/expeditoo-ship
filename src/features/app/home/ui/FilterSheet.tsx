"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";
import { useEffect } from "react";
import type { Filters } from "../types";

interface FilterSheetProps {
  isOpen: boolean;
  onClose: () => void;
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  onApplyFilters: () => void; // NEW: Trigger API call
  onClearFilters: () => void; // NEW: Clear all filters
}

/**
 * FilterSheet component
 * Following rules.md:
 * - Pure UI component with no business logic
 * - All state management handled by parent via props
 */
import { useTranslations } from "next-intl";

export function FilterSheet({
  isOpen,
  onClose,
  filters,
  onFiltersChange,
  onApplyFilters,
  onClearFilters,
}: FilterSheetProps) {
  const t = useTranslations("common");
  const tHome = useTranslations("home.filters");
  const sizes = ["XS", "S", "M", "L", "XL", "XXL"];

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  const handleSizeToggle = (size: string) => {
    const newSizes = filters.sizes.includes(size)
      ? filters.sizes.filter((s) => s !== size)
      : [...filters.sizes, size];
    onFiltersChange({ ...filters, sizes: newSizes });
  };

  const handleApplyClick = () => {
    onApplyFilters(); // Trigger API call
    onClose(); // Close sheet
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 animate-fade-in"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="fixed inset-x-0 bottom-0 md:right-0 md:left-auto md:top-0 md:w-96 bg-background z-50 rounded-t-2xl md:rounded-none shadow-xl animate-slide-up md:animate-slide-left">
        <div className="flex flex-col h-full max-h-[90vh] md:max-h-full pb-24 md:pb-0">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border">
            <h2 className="text-xl font-bold text-foreground">{tHome("title")}</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-muted rounded-lg transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Sort By */}
            <div>
              <Label className="text-base font-semibold mb-4 block">
                {tHome("sortBy")}
              </Label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: tHome("sortOptions.endingSoon"), value: "ending_soon" },
                  { label: tHome("sortOptions.newest"), value: "newest" },
                  { label: tHome("sortOptions.priceLow"), value: "price_low" },
                  { label: tHome("sortOptions.priceHigh"), value: "price_high" },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() =>
                      onFiltersChange({
                        ...filters,
                        sortBy: option.value as Filters["sortBy"],
                      })
                    }
                    className={`h-12 rounded-lg font-medium text-sm transition-all ${filters.sortBy === option.value
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "bg-muted text-muted-foreground hover:bg-border"
                      }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Category */}
            <div>
              <Label className="text-base font-semibold mb-4 block">
                {tHome("category")}
              </Label>
              <div className="flex flex-wrap gap-2">
                {["documents", "furniture", "electronics", "others"].map(
                  (cat) => (
                    <button
                      key={cat}
                      onClick={() =>
                        onFiltersChange({
                          ...filters,
                          category: filters.category === cat ? null : cat,
                        })
                      }
                      className={`px-4 py-2 rounded-full font-medium text-sm transition-all ${filters.category === cat
                        ? "bg-primary text-primary-foreground shadow-md"
                        : "bg-muted text-muted-foreground hover:bg-border"
                        }`}
                    >
                      {t(`categories.${cat}`)}
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Price Range */}
            <div>
              <Label className="text-base font-semibold mb-4 block">
                {tHome("priceRange")}
              </Label>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {tHome("min")}: €{filters.priceRange[0]}
                  </span>
                  <span className="text-muted-foreground">
                    {tHome("max")}: €{filters.priceRange[1]}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="500"
                  value={filters.priceRange[1]}
                  onChange={(e) =>
                    onFiltersChange({
                      ...filters,
                      priceRange: [
                        filters.priceRange[0],
                        Number.parseInt(e.target.value),
                      ],
                    })
                  }
                  className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>
            </div>

            {/* Size */}
            <div>
              <Label className="text-base font-semibold mb-4 block">{tHome("size")}</Label>
              <div className="grid grid-cols-3 gap-3">
                {sizes.map((size) => (
                  <button
                    key={size}
                    onClick={() => handleSizeToggle(size)}
                    className={`h-12 rounded-lg font-medium text-sm transition-all ${filters.sizes.includes(size)
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "bg-muted text-muted-foreground hover:bg-border"
                      }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-border space-y-3">
            <Button
              onClick={handleApplyClick}
              className="w-full h-12 rounded-full"
            >
              {t("buttons.apply")}
            </Button>
            <Button
              onClick={onClearFilters}
              variant="outline"
              className="w-full h-12 rounded-full bg-transparent"
            >
              {t("buttons.clear")}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
