"use client";

import { useTranslations } from "next-intl";
import { PageLoader } from "@/components/ui/page-loader";
import { ReviewCard } from "@/features/app/profile/ui/ReviewCard";
import { useListingReviews } from "../hooks/useListingReviews";

interface ListingReviewsProps {
  listingId: string;
}

export function ListingReviews({ listingId }: ListingReviewsProps) {
  const { reviews, isLoading } = useListingReviews(listingId);
  const t = useTranslations("listing");

  if (isLoading) {
    return <PageLoader />;
  }

  return (
    <div className="mt-6">
      <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
        {t("reviewsTitle")}
        <span className="text-sm text-muted-foreground font-normal">
          ({reviews.length})
        </span>
      </h2>

      {reviews.length > 0 ? (
        <div className="space-y-4">
          {reviews.map((review) => (
            <ReviewCard key={review.id} {...review} />
          ))}
        </div>
      ) : (
        <div className="text-center py-8 bg-muted rounded-xl">
          <p className="text-muted-foreground">
            {t("noReviews")}
          </p>
        </div>
      )}
    </div>
  );
}
