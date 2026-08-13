"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useRouter } from "next/navigation";
import {
  Clock,
  MapPin,
  Share2,
  ShieldCheck,
  Star,
  ArrowLeft,
  Trophy,
  XCircle,
  Ban,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Zap,
  Bot,
} from "lucide-react";
import { LottieLoader } from "@/components/ui/lottie-loader";
import { useAuctionDetail } from "../hooks/useAuctionDetail";
import { ListingMap } from "./ListingMap";
import { AutoBidDialog } from "./AutoBidDialog";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { initChat } from "../api";
import { PageLoader } from "@/components/ui/page-loader";
import { useTranslations } from "next-intl";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

import { shareContent } from "@/lib/share";

// Status badge configuration
// Configs moved inside component for translation access

export function AuctionDetail({
  id,
  onBack,
}: {
  id: string;
  onBack?: () => void;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isMessageLoading, setIsMessageLoading] = useState(false);
  const [autoBidOpen, setAutoBidOpen] = useState(false);
  const {
    auction,
    bids,
    bidAmount,
    setBidAmount,
    timeLeft,
    currentHighestBid,
    handlePlaceBid,
    isOwnListing,
    isPlacingBid,
  } = useAuctionDetail(id);

  const t = useTranslations("auction");

  const handleShare = async () => {
    if (!auction) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/auction/${auction.id}`;
    
    await shareContent({
      title: auction.title,
      text: `Check out this auction: ${auction.title}`,
      url: url,
      onCopy: () => toast.success(t("share.copied"))
    });
  };

  const statusConfig = {
    active: {
      label: t("status.live"),
      className: "bg-green-500 animate-pulse",
      icon: null,
    },
    sold: {
      label: t("status.sold"),
      className: "bg-blue-500",
      icon: Trophy,
    },
    ended: {
      label: t("status.ended"),
      className: "bg-gray-500",
      icon: XCircle,
    },
    cancelled: {
      label: t("status.cancelled"),
      className: "bg-red-500",
      icon: Ban,
    },
  };

  if (!auction) {
    return <PageLoader className="min-h-[60vh]" />;
  }

  const isActive = auction.status === "active";
  const isSold = auction.status === "sold";
  const isEnded = auction.status === "ended";
  const isCancelled = auction.status === "cancelled";
  const isFinished = !isActive;

  const handleChatSeller = async () => {
    if (!user) {
      toast.error(t("errors.loginToChat"));
      router.push("/auth/login");
      return;
    }

    if (user.id === auction.seller.id) {
      toast.error(t("errors.chatSelf"));
      return;
    }

    try {
      setIsMessageLoading(true);
      // Use the generic init endpoint which handles finding or creating conversation
      const { conversationId } = await initChat({
        recipientId: auction.seller.id,
        listingId: auction.id,
      });

      router.push(`/messages/${conversationId}`);
    } catch (error) {
      console.error("Chat init error:", error);
      toast.error(error instanceof Error ? error.message : t("errors.generic"));
    } finally {
      setIsMessageLoading(false);
    }
  };

  /* Get winner info (highest bidder if sold OR ended with bids) */
  const winner =
    (isSold || (isEnded && bids.length > 0)) && bids.length > 0
      ? bids[0]
      : null;
  const statusInfo =
    statusConfig[auction.status as keyof typeof statusConfig] ||
    statusConfig.ended;
  const StatusIcon = statusInfo.icon;

  return (
    <div className="mx-auto p-4 md:p-6 pb-40 md:pb-12">
      {/* Back Button & Header Actions */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full -ml-2"
            onClick={() => (onBack ? onBack() : router.back())}
          >
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <Badge variant="outline" className="text-sm">
            {t(`category.${auction.category.toLowerCase()}`)}
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" className="rounded-full" onClick={handleShare}>
            <Share2 className="w-5 h-5" />
          </Button>
        </div>
      </div>


      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left Column: Image & Details */}
        <div className="space-y-6">
          {/* Image Carousel */}
          <div className="relative aspect-square md:aspect-4/3 rounded-2xl overflow-hidden bg-muted">
            <img
              src={auction.images?.[currentImageIndex] || auction.image}
              alt={auction.title}
              className={`w-full h-full object-cover ${isFinished ? "grayscale-30" : ""}`}
              onTouchStart={(e) => {
                const touch = e.touches[0];
                e.currentTarget.dataset.touchStartX = touch.clientX.toString();
              }}
              onTouchEnd={(e) => {
                const images = auction.images || [];
                if (images.length <= 1) return;
                const startX = parseFloat(
                  e.currentTarget.dataset.touchStartX || "0"
                );
                const endX = e.changedTouches[0].clientX;
                const diff = startX - endX;

                if (Math.abs(diff) > 50) {
                  if (diff > 0 && currentImageIndex < images.length - 1) {
                    setCurrentImageIndex(currentImageIndex + 1);
                  } else if (diff < 0 && currentImageIndex > 0) {
                    setCurrentImageIndex(currentImageIndex - 1);
                  }
                }
              }}
            />

            {/* Status Badge */}
            <div className="absolute top-4 left-4">
              <Badge className={statusInfo.className}>
                {StatusIcon && <StatusIcon className="w-3 h-3 mr-1" />}
                {statusInfo.label}
              </Badge>
            </div>

            {/* Image Counter */}
            {auction.images && auction.images.length > 1 && (
              <div className="absolute top-4 right-4 bg-black/50 text-white text-sm px-2 py-1 rounded-full">
                {currentImageIndex + 1} / {auction.images.length}
              </div>
            )}

            {/* Arrow Buttons */}
            {auction.images && auction.images.length > 1 && (
              <>
                <button
                  onClick={() =>
                    setCurrentImageIndex(Math.max(0, currentImageIndex - 1))
                  }
                  className={`absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-all ${currentImageIndex === 0 ? "opacity-30 cursor-not-allowed" : ""}`}
                  disabled={currentImageIndex === 0}
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  onClick={() =>
                    setCurrentImageIndex(
                      Math.min(
                        auction.images!.length - 1,
                        currentImageIndex + 1
                      )
                    )
                  }
                  className={`absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-all ${currentImageIndex === auction.images!.length - 1 ? "opacity-30 cursor-not-allowed" : ""}`}
                  disabled={currentImageIndex === auction.images!.length - 1}
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}

            {/* Dots Indicator */}
            {auction.images && auction.images.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                {auction.images.map((_: string, idx: number) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentImageIndex(idx)}
                    className={`w-2 h-2 rounded-full transition-all ${idx === currentImageIndex ? "bg-white w-6" : "bg-white/50"}`}
                  />
                ))}
              </div>
            )}
          </div>
          {/* Title */}
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">{auction.title}</h1>
          </div>
          {/* Description */}
          <div className="space-y-3">
            <h3 className="font-semibold text-lg">{t("description")}</h3>
            <p className="text-muted-foreground leading-relaxed">
              {auction.description}
            </p>
            <div className="flex gap-4 pt-2">
              <div className="bg-muted px-3 py-1.5 rounded-lg text-sm font-medium">
                Condition: {t(`condition.${auction.condition}`)}
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="space-y-3">
            <h3 className="font-semibold text-lg">{t("pickupLocation")}</h3>
            <div className="bg-muted/50 rounded-xl p-4 flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">{auction.location.city}</p>
                  <p className="text-sm text-muted-foreground">
                    {auction.location.address}
                  </p>
                </div>
              </div>
              <div className="mt-2 h-64 bg-muted rounded-lg w-full overflow-hidden border">
                <ListingMap
                  lat={auction.location.lat}
                  lng={auction.location.lng}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Bidding & Seller */}
        <div className="space-y-6">
          {/* Desktop Status Card */}
          <div className="hidden md:block bg-card rounded-xl border p-6 space-y-4">
            {/* Status-specific content */}
            {isActive && (
              <>
                {/* Timer */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-red-500">
                    <Clock className="w-5 h-5" />
                    <span className="font-semibold">{timeLeft}</span>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <ShieldCheck className="w-4 h-4 text-green-500" />
                    <span>{t("status.secure")}</span>
                  </div>
                </div>

                {/* Current Bid */}
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-sm text-muted-foreground mb-1">
                    {t("currentBid")}
                  </p>
                  <p className="text-3xl font-bold text-primary">
                    €{currentHighestBid}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {bids.length} bid{bids.length !== 1 ? "s" : ""} · Min.
                    increase: €{auction.minimumIncrease}
                  </p>
                </div>

                {/* Bid Input - Hidden for own listing */}
                {isOwnListing ? (
                  <div className="bg-muted/30 rounded-lg p-4 text-center border border-dashed">
                    <p className="text-muted-foreground text-sm">
                      {t("detail.ownListing")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("detail.cannotBid")}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-3">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                          €
                        </span>
                        <Input
                          type="number"
                          placeholder={`${currentHighestBid + auction.minimumIncrease} or more`}
                          className="pl-8 h-12 text-lg"
                          value={bidAmount}
                          onChange={(e) => setBidAmount(e.target.value)}
                        />
                      </div>
                      <Button
                        className="w-full h-12 font-bold text-base"
                        onClick={handlePlaceBid}
                        disabled={
                          isPlacingBid ||
                          !bidAmount ||
                          Number(bidAmount) <= currentHighestBid
                        }
                      >
                        {isPlacingBid ? t("placingBid") : t("placeBid")}
                      </Button>
                    </div>

                    {/* Quick Bid Buttons */}
                    <div className="flex gap-2">
                      {[10, 25, 50].map((increment) => (
                        <Button
                          key={increment}
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() =>
                            setBidAmount(String(currentHighestBid + increment))
                          }
                        >
                          +€{increment}
                        </Button>
                      ))}
                    </div>

                    {/* Buy Now & Auto-Bid Buttons */}
                    {/* <div className="flex gap-2 pt-2 border-t mt-2">
                      {auction.buyNowPrice && auction.buyNowPrice > 0 && (
                        <Button
                          variant="secondary"
                          className="flex-1 h-10 gap-2"
                          onClick={() =>
                            router.push(`/checkout/${auction.id}?buyNow=true`)
                          }
                        >
                          <Zap className="w-4 h-4" />
                          {t("buyNow.label")} €{auction.buyNowPrice}
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        className="flex-1 h-10 gap-2"
                        onClick={() => setAutoBidOpen(true)}
                      >
                        <Bot className="w-4 h-4" />
                        {t("autoBid.title")}
                      </Button>
                    </div> */}
                  </>
                )}
              </>
            )}

            {/* SOLD Status */}
            {isSold && (
              <div className="space-y-4">
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-6 text-center">
                  <Trophy className="w-12 h-12 text-blue-500 mx-auto mb-3" />
                  <h3 className="text-xl font-bold text-blue-500 mb-1">
                    {t("detail.soldTitle")}
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    {t("detail.soldDesc")}
                  </p>
                </div>

                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-sm text-muted-foreground mb-1">
                    {t("detail.winningBid")}
                  </p>
                  <p className="text-3xl font-bold text-blue-500">
                    €{currentHighestBid}
                  </p>
                </div>

                {winner && (
                  <div className="bg-card border rounded-lg p-4">
                    <p className="text-xs text-muted-foreground mb-2">
                      {t("detail.winner")}
                    </p>
                    <div className="flex items-center gap-3">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={winner.image || undefined} />
                        <AvatarFallback className="bg-blue-500 text-white">
                          {winner.avatar}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-semibold">{winner.bidder}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Trophy className="w-3 h-3 text-blue-500" />
                          {t("detail.highestBidder")}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ENDED Status (no bids or with bids - show winner if has bids) */}
            {isEnded && (
              <div className="space-y-4">
                <div className="bg-gray-500/10 border border-gray-500/30 rounded-xl p-6 text-center">
                  <XCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <h3 className="text-xl font-bold text-gray-400 mb-1">
                    {t("detail.endedTitle")}
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    {bids.length === 0
                      ? t("detail.endedNoBids")
                      : t("detail.endedWithBids")}
                  </p>
                </div>

                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-sm text-muted-foreground mb-1">
                    {bids.length > 0
                      ? t("detail.finalBid")
                      : t("detail.startPrice")}
                  </p>
                  <p className="text-3xl font-bold text-muted-foreground">
                    €{currentHighestBid}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {bids.length} bid{bids.length !== 1 ? "s" : ""}
                  </p>
                </div>

                {/* Show winner if auction ended with bids */}
                {winner && (
                  <div className="bg-card border rounded-lg p-4">
                    <p className="text-xs text-muted-foreground mb-2">
                      {t("detail.winner")}
                    </p>
                    <div className="flex items-center gap-3">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={winner.image || undefined} />
                        <AvatarFallback className="bg-green-500 text-white">
                          {winner.avatar}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-semibold">{winner.bidder}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Trophy className="w-3 h-3 text-green-500" />
                          {t("detail.highestBidder")}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* CANCELLED Status */}
            {isCancelled && (
              <div className="space-y-4">
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
                  <Ban className="w-12 h-12 text-red-500 mx-auto mb-3" />
                  <h3 className="text-xl font-bold text-red-500 mb-1">
                    {t("detail.cancelledTitle")}
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    {t("detail.cancelledDesc")}
                  </p>
                </div>

                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-sm text-muted-foreground mb-1">
                    {t("detail.originalPrice")}
                  </p>
                  <p className="text-3xl font-bold text-muted-foreground line-through">
                    €{currentHighestBid}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Seller Profile */}
          <div className="bg-card rounded-xl border p-4 flex items-center gap-4">
            <Avatar className="w-12 h-12">
              <AvatarImage src={auction.seller.avatar || undefined} />
              <AvatarFallback className="bg-linear-to-b from-blue-400 to-blue-600 dark:from-blue-600 dark:to-blue-950 text-white">
                {auction.seller.name
                  .split(" ")
                  .map((n: string) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 1)}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1">
              <div className="flex items-center gap-1">
                <p className="font-semibold">{auction.seller.name}</p>
                {auction.seller.isVerified && <VerifiedBadge size={16} />}
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                <span className="font-medium text-foreground">
                  {auction.seller.rating}
                </span>
                <span>
                  ({t("detail.reviews", { count: auction.seller.reviews })})
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              {!isOwnListing && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleChatSeller}
                  disabled={isMessageLoading}
                  className="gap-2"
                >
                  {isMessageLoading ? (
                    <LottieLoader width={20} height={20} />
                  ) : (
                    <MessageSquare className="w-4 h-4" />
                  )}
                  {t("detail.chat")}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/user/${auction.seller.id}`)}
              >
                {t("detail.viewProfile")}
              </Button>
            </div>
          </div>

          {/* Bid History */}
          <div>
            <h3 className="font-semibold mb-4">{t("bidHistory")}</h3>
            {bids.length > 0 ? (
              <div className="space-y-4">
                {bids.map((bid, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={bid.image || undefined} />
                        <AvatarFallback
                          className={`text-xs ${idx === 0 && (isSold || (isEnded && bids.length > 0)) ? "bg-blue-500 text-white" : ""}`}
                        >
                          {bid.avatar}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium flex items-center gap-1">
                          {bid.bidder}
                          {idx === 0 &&
                            (isSold || (isEnded && bids.length > 0)) && (
                              <Trophy className="w-3 h-3 text-blue-500" />
                            )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {bid.time}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`font-semibold ${idx === 0 && isSold ? "text-blue-500" : ""}`}
                    >
                      €{bid.amount}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 bg-muted/30 rounded-xl border border-dashed">
                <p className="text-muted-foreground text-sm">
                  {isActive ? t("detail.noBidsYet") : t("detail.noBidsPlaced")}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Sticky Bar - Only for active auctions */}
      {isActive && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 p-4 bg-background border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-50">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs text-muted-foreground">
                {t("detail.currentBid")}
              </p>
              <p className="text-xl font-bold text-primary">
                €{currentHighestBid}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">
                {t("detail.endsIn")}
              </p>
              <p className="text-sm font-medium text-red-500">{timeLeft}</p>
            </div>
          </div>
          {isOwnListing ? (
            <div className="bg-muted/30 rounded-lg py-3 text-center border border-dashed">
              <p className="text-muted-foreground text-sm">
                {t("detail.ownListing")} · {t("detail.cannotBid")}
              </p>
            </div>
          ) : (
            <div className="flex gap-3">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  €
                </span>
                <Input
                  type="number"
                  placeholder={`${currentHighestBid + auction.minimumIncrease}+`}
                  className="pl-6 h-12"
                  value={bidAmount}
                  onChange={(e) => setBidAmount(e.target.value)}
                />
              </div>
              <Button
                className="h-12 px-6 font-bold"
                onClick={handlePlaceBid}
                disabled={
                  isPlacingBid ||
                  !bidAmount ||
                  Number(bidAmount) <= currentHighestBid
                }
              >
                {isPlacingBid ? t("placingBid") : t("placeBid")}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Mobile Sticky Action Bar - For active auctions */}
      {isActive && !isOwnListing && (
        <div className="md:hidden fixed bottom-16 left-4 right-4 z-50">
           {/* Floating Buttons Container */}
           <div className="flex gap-2 shadow-lg rounded-full p-1 bg-background border">
              {/* Buy Now Button */}
              {auction.buyNowPrice && auction.buyNowPrice > 0 && (
                <Button
                  variant="secondary"
                  className="rounded-l-full flex-1 h-12 font-semibold pl-6 pr-4"
                  onClick={() => router.push(`/checkout/${auction.id}?buyNow=true`)}
                >
                  <Zap className="w-4 h-4 mr-2" />
                  {t("buyNow.label")} €{auction.buyNowPrice}
                </Button>
              )}
              
              {/* Bid Button / Drawer */}
              <Drawer>
                <DrawerTrigger asChild>
                  <Button 
                    className={`rounded-r-full flex-1 h-12 font-bold ${!auction.buyNowPrice ? 'rounded-l-full' : ''}`}
                    size="lg"
                  >
                    {t("placeBid")}
                  </Button>
                </DrawerTrigger>
                <DrawerContent>
                  <DrawerHeader>
                    <DrawerTitle>{t("placeBid")}</DrawerTitle>
                    <DrawerDescription>
                      {t("currentBid")}: €{currentHighestBid}
                    </DrawerDescription>
                  </DrawerHeader>
                  <div className="p-4 space-y-4">
                     <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                          €
                        </span>
                        <Input
                          type="number"
                          placeholder={`${currentHighestBid + auction.minimumIncrease}+`}
                          className="pl-8 h-12 text-lg"
                          value={bidAmount}
                          onChange={(e) => setBidAmount(e.target.value)}
                        />
                      </div>
                      <div className="flex gap-2">
                        {[10, 25, 50].map((increment) => (
                          <Button
                            key={increment}
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() =>
                              setBidAmount(String(currentHighestBid + increment))
                            }
                          >
                            +€{increment}
                          </Button>
                        ))}
                      </div>
                  </div>
                  <DrawerFooter>
                    <Button 
                      className="w-full h-12 font-bold text-lg"
                      onClick={handlePlaceBid}
                      disabled={
                        isPlacingBid ||
                        !bidAmount ||
                        Number(bidAmount) <= currentHighestBid
                      }
                    >
                      {isPlacingBid ? t("placingBid") : t("placeBid")}
                    </Button>
                    <DrawerClose asChild>
                      <Button variant="outline">{t("cancel")}</Button>
                    </DrawerClose>
                  </DrawerFooter>
                </DrawerContent>
              </Drawer>
           </div>
        </div>
      )}

      {/* Mobile Sticky Bar - For finished auctions */}
      {isFinished && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 p-4 bg-background border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-50">
          <div
            className={`rounded-lg py-3 px-4 text-center ${
              isSold
                ? "bg-blue-500/10 border border-blue-500/30"
                : isCancelled
                  ? "bg-red-500/10 border border-red-500/30"
                  : "bg-muted/50 border"
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              {isSold && <Trophy className="w-5 h-5 text-blue-500" />}
              {isEnded && <XCircle className="w-5 h-5 text-gray-400" />}
              {isCancelled && <Ban className="w-5 h-5 text-red-500" />}
              <span
                className={`font-semibold ${
                  isSold
                    ? "text-blue-500"
                    : isCancelled
                      ? "text-red-500"
                      : "text-muted-foreground"
                }`}
              >
                {isSold && t("detail.soldFor", { amount: currentHighestBid })}
                {isEnded &&
                  (bids.length > 0
                    ? t("detail.endedAt", { amount: currentHighestBid })
                    : t("detail.endedNoBidsMobile"))}
                {isCancelled && t("detail.cancelledMobile")}
              </span>
            </div>
          </div>
        </div>
      )}
      {/* Auto-Bid Dialog */}
      <AutoBidDialog
        open={autoBidOpen}
        onOpenChange={setAutoBidOpen}
        currentBid={currentHighestBid}
        minimumIncrease={auction.minimumIncrease}
        onConfirm={(maxBid, increment) => {
          // TODO: Implement auto-bid API call
          toast.success(
            `Auto-bid enabled: max €${maxBid}, increment €${increment}`
          );
        }}
      />
    </div>
  );
}
