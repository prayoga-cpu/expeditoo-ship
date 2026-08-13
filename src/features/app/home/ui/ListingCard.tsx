"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, MapPin, Gavel } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import type { Listing } from "../types";
import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { formatCurrency } from "@/lib/currency";

interface ListingCardProps {
  listing: Listing;
  onClick: () => void;
  index?: number;
}

/**
 * ListingCard component
 * Following rules.md:
 * - Pure UI component with no business logic
 * - Receives all data via props
 * - NO individual Ably subscription (uses list-level polling for efficiency)
 */
export function ListingCard({ listing, onClick, index = 0 }: ListingCardProps) {
  const [imgSrc, setImgSrc] = useState(listing.imageUrl);
  const t = useTranslations("home.actions");
  const tCommon = useTranslations("common");

  // Use props directly - list is refreshed via polling at parent level
  const currentBid = listing.currentBid;
  const bidCount = listing.bids;

  const locale = useLocale();

  const timeLeft = formatDistanceToNow(new Date(listing.deadline), {
    addSuffix: true,
    locale: locale === "fr" ? fr : undefined,
  });
  const isUrgent =
    new Date(listing.deadline).getTime() - Date.now() < 24 * 60 * 60 * 1000;

  return (
    <div
      onClick={onClick}
      className="group bg-card border rounded-xl overflow-hidden hover:shadow-lg hover:border-primary/50 transition-all duration-200 cursor-pointer animate-fade-in flex flex-col"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="flex flex-col sm:flex-row">
        {/* Image Section */}
        <div className="w-full sm:w-48 h-48 sm:h-auto sm:self-stretch shrink-0 relative bg-muted">
          <img
            src={imgSrc || "/image-not-found.svg"}
            alt={listing.title}
            onError={() => setImgSrc("/image-not-found.svg")}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute top-2 left-2">
            <Badge
              variant="secondary"
              className="backdrop-blur-md bg-background/80"
            >
              {tCommon(`categories.${listing.category.toLowerCase()}`)}
            </Badge>
          </div>
        </div>

        {/* Content Section */}
        <div className="flex-1 p-4 flex flex-col justify-between min-w-0">
          <div>
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-semibold text-lg line-clamp-1 group-hover:text-primary transition-colors">
                {listing.title}
              </h3>
              <Badge
                variant="outline"
                className="ml-2 shrink-0 text-xs font-medium"
              >
                {listing.size}
              </Badge>
            </div>

            {/* Location & Description */}
            <div className="space-y-1.5 mb-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="truncate">{listing.origin.city}</span>
              </div>
              {listing.description && (
                <p className="text-sm text-muted-foreground line-clamp-1">
                  {listing.description}
                </p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-end justify-between py-3 border-t border-border/50">
            <div>
              <div className="text-2xl font-bold text-primary">
                {formatCurrency(currentBid * 100, 0)}
              </div>
              <div className="text-xs text-muted-foreground">
                {bidCount} {bidCount !== 1 ? t("bids") : t("bid")}
              </div>
            </div>
            <div className="text-right">
              <div
                className={`flex items-center gap-1.5 text-sm font-medium ${isUrgent ? "text-red-500" : "text-muted-foreground"}`}
                suppressHydrationWarning
              >
                <Clock className="w-3.5 h-3.5" />
                <span suppressHydrationWarning>{timeLeft}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {listing.distance}
              </div>
            </div>
          </div>
          {/* Place Bid Button */}
          <Button
            className="w-full h-9 font-semibold gap-2"
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
          >
            <Gavel className="w-4 h-4" />
            {t("placeBid")}
          </Button>
        </div>
      </div>
    </div>
  );
}
