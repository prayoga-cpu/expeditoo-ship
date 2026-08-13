"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { CreateReviewModal } from "@/features/app/common/ui/CreateReviewModal";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MapPin,
  Ruler,
  Weight,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  Star,
  Share2,
} from "lucide-react";
import { shareContent } from "@/lib/share";
import { toast } from "sonner";
import { ListingReviews } from "./ListingReviews";
import { useListingDetail } from "../hooks/useListingDetail";
import { PageLoader } from "@/components/ui/page-loader";
import { useTranslations } from "next-intl";

export function ListingDetail({ id }: { id: string }) {
  const {
    listing,
    showMore,
    setShowMore,
    currentImageIndex,
    setCurrentImageIndex,
    isLoading,
  } = useListingDetail(id);

  const t = useTranslations("listing");

  const handleShare = async () => {
    if (!listing) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/listing/${listing.id}`;
    
    await shareContent({
      title: listing.title,
      text: `Check out this listing: ${listing.title}`,
      url: url,
      onCopy: () => toast.success(t("share.copied"))
    });
  };

  if (isLoading) {
    return <PageLoader />;
  }

  if (!listing) return null;

  return (
    <div className="  mx-auto p-4 md:p-6 pb-24 md:pb-6">
      {/* Image Carousel */}
      <div className="relative rounded-2xl overflow-hidden bg-linear-to-br from-primary/20 to-accent-pink/20 mb-6 h-64 md:h-96">
        <div
          className="w-full h-full bg-cover bg-center transition-all"
          style={{
            backgroundImage: `url('${listing.images[currentImageIndex]}')`,
          }}
          onTouchStart={(e) => {
            const touch = e.touches[0];
            e.currentTarget.dataset.touchStartX = touch.clientX.toString();
          }}
          onTouchEnd={(e) => {
            const startX = parseFloat(
              e.currentTarget.dataset.touchStartX || "0"
            );
            const endX = e.changedTouches[0].clientX;
            const diff = startX - endX;

            if (Math.abs(diff) > 50) {
              if (diff > 0 && currentImageIndex < listing.images.length - 1) {
                setCurrentImageIndex(currentImageIndex + 1);
              } else if (diff < 0 && currentImageIndex > 0) {
                setCurrentImageIndex(currentImageIndex - 1);
              }
            }
          }}
        />

        {/* Arrow buttons for desktop */}
        {listing.images.length > 1 && (
          <>
            <button
              onClick={() =>
                setCurrentImageIndex(Math.max(0, currentImageIndex - 1))
              }
              className={`absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-all ${currentImageIndex === 0 ? "opacity-30 cursor-not-allowed" : ""}`}
              disabled={currentImageIndex === 0}
            >
              ‹
            </button>
            <button
              onClick={() =>
                setCurrentImageIndex(
                  Math.min(listing.images.length - 1, currentImageIndex + 1)
                )
              }
              className={`absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-all ${currentImageIndex === listing.images.length - 1 ? "opacity-30 cursor-not-allowed" : ""}`}
              disabled={currentImageIndex === listing.images.length - 1}
            >
              ›
            </button>
          </>
        )}

        {/* Dots indicator */}
        {listing.images.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
            {listing.images.map((_: string, idx: number) => (
              <button
                key={idx}
                onClick={() => setCurrentImageIndex(idx)}
                className={`w-2 h-2 rounded-full transition-all ${
                  idx === currentImageIndex ? "bg-white w-6" : "bg-white/50"
                }`}
              />
            ))}
          </div>
        )}

        {/* Image counter */}
        {listing.images.length > 1 && (
          <div className="absolute top-4 right-4 bg-black/50 text-white text-sm px-2 py-1 rounded-full">
            {currentImageIndex + 1} / {listing.images.length}
          </div>
        )}
      </div>

      {/* Main Info */}
      <div className="mb-6">
        <div className="flex justify-between items-start gap-4 mb-3">

          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            {listing.title}
          </h1>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="rounded-full" onClick={handleShare}>
                <Share2 className="w-5 h-5" />
            </Button>
            <Badge className="bg-accent-pink/20 text-accent-pink text-lg px-4 py-2">
                {listing.price}€
            </Badge>
          </div>
        </div>

        {/* Sender info */}
        <div className="flex items-center gap-3 p-3 bg-muted rounded-lg mb-4">
          <div className="w-10 h-10 rounded-full bg-linear-to-br from-primary to-accent-pink" />
          <div className="flex-1">
            <p className="font-bold text-foreground">{listing.sender.name}</p>
            <p className="text-sm text-muted-foreground">
              ⭐ {listing.sender.rating}/5 -{" "}
              {t("reviews", { count: listing.sender.reviews })}
            </p>
          </div>
        </div>

        {/* Route info */}
        <div className="space-y-2 mb-4">
          <div className="flex gap-3">
            <MapPin className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-muted-foreground">{t("from")}</p>
              <p className="font-medium text-foreground">{listing.origin}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <MapPin className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-muted-foreground">{t("to")}</p>
              <p className="font-medium text-foreground">
                {listing.destination}
              </p>
            </div>
          </div>
        </div>

        {/* Dates */}
        <div className="text-sm text-muted-foreground mb-6">
          {listing.dates}
        </div>
      </div>

      {/* Item Details */}
      <div className="bg-card rounded-xl p-4 border border-border mb-6">
        <h2 className="font-bold text-foreground mb-4">{t("description")}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">
              {listing.quantity}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t("quantity")}
            </p>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">
              {listing.size}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{t("size")}</p>
          </div>
          <div className="flex items-center justify-center gap-1">
            <Weight className="w-5 h-5 text-primary" />
            <div>
              <div className="font-bold text-primary">{listing.weight}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {t("weight")}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-center gap-1">
            <Ruler className="w-5 h-5 text-primary" />
            <div>
              <div className="font-bold text-primary">
                {listing.dimensions.length}x{listing.dimensions.width}x
                {listing.dimensions.height}cm
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {t("dimensions")}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="bg-card rounded-xl p-4 border border-border mb-6">
        <h2 className="font-bold text-foreground mb-3">{t("description")}</h2>
        <p className="text-foreground">{listing.description}</p>
      </div>

      <ListingReviews listingId={id} />

      {/* More Info Collapsible */}
      <button
        onClick={() => setShowMore(!showMore)}
        className="w-full flex items-center justify-between p-4 rounded-xl border border-border hover:bg-muted/50 transition-smooth mb-6 mt-6"
      >
        <span className="font-bold text-foreground">{t("moreInfo")}</span>
        {showMore ? (
          <ChevronUp className="w-5 h-5" />
        ) : (
          <ChevronDown className="w-5 h-5" />
        )}
      </button>

      {showMore && (
        <div className="bg-muted rounded-xl p-4 mb-6 space-y-2 text-sm text-foreground">
          <p>• {t("info.handling")}</p>
          <p>• {t("info.signature")}</p>
          <p>• {t("info.packaging")}</p>
        </div>
      )}

      {/* CTA Buttons */}
      <ReviewActionButtons listing={listing} />
    </div>
  );
}

function ReviewActionButtons({
  listing,
}: {
  listing: ReturnType<typeof useListingDetail>["listing"];
}) {
  const { user } = useAuth();
  const t = useTranslations("listing");
  const [showReviewModal, setShowReviewModal] = useState(false);

  if (!listing || !user) return null;

  // Review Logic
  const isSold = listing.status === "sold" || listing.status === "ended";
  const isBuyer = user.id === listing.winnerId;
  const isSeller = user.id === listing.sellerId;
  const canReview = isSold && (isBuyer || isSeller);

  // Determine target for review
  const reviewTargetId = isBuyer ? listing.sellerId : listing.winnerId || "";
  const reviewTargetName = isBuyer ? listing.sender.name : "Buyer";

  if (canReview) {
    return (
      <>
        <div className="fixed bottom-20 md:bottom-6 left-0 right-0 md:relative px-4 md:px-0 space-y-2 mt-6">
          <Button
            className="w-full h-12 rounded-full text-base font-bold bg-yellow-500 hover:bg-yellow-600 text-black"
            onClick={() => setShowReviewModal(true)}
          >
            <Star className="w-5 h-5 mr-2 fill-current" />
            {t("writeReview")}
          </Button>
        </div>
        <CreateReviewModal
          isOpen={showReviewModal}
          onClose={() => setShowReviewModal(false)}
          targetUserId={reviewTargetId}
          targetUserName={reviewTargetName}
          listingId={listing.id}
        />
      </>
    );
  }

  return (
    <div className="fixed bottom-20 md:bottom-6 left-0 right-0 md:relative px-4 md:px-0 space-y-2 mt-6">
      <Button className="w-full h-12 rounded-full text-base font-bold">
        {t("makeOffer")}
      </Button>
      <Button
        variant="outline"
        className="w-full h-12 rounded-full text-base font-bold gap-2 bg-transparent"
      >
        <MessageCircle className="w-5 h-5" />
        {t("contactSeller")}
      </Button>
    </div>
  );
}
