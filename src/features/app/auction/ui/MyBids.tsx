"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMyBids, Bid, BidStatus } from "../hooks/useMyBids";
import { formatCurrency } from "@/lib/currency";
import { PageLoader } from "@/components/ui/page-loader";
import { useTranslations, useLocale } from "next-intl";
import { fr, enUS } from "date-fns/locale";
import {
  Clock,
  Trophy,
  AlertTriangle,
  XCircle,
  TrendingUp,
  ArrowLeft,
  Star,
} from "lucide-react";
import { CreateReviewModal } from "@/features/app/common/ui/CreateReviewModal";

type TabFilter = "active" | "ended";

export function MyBids() {
  const t = useTranslations("bids");
  const { bids, isLoading } = useMyBids();
  const [activeTab, setActiveTab] = useState<TabFilter>("active");
  const searchParams = useSearchParams();
  const showBackButton = searchParams.get("from") === "profile";

  // Filter bids based on tab
  const activeBids = bids.filter(
    (bid) => bid.status === "WINNING" || bid.status === "OUTBID"
  );
  const endedBids = bids.filter(
    (bid) => bid.status === "WON" || bid.status === "LOST"
  );

  const tabCounts = {
    active: activeBids.length,
    ended: endedBids.length,
  };

  if (isLoading) {
    return <PageLoader variant="default" />;
  }

  return (
    <div className="space-y-6">
      <Tabs
        defaultValue="active"
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as TabFilter)}
        className="space-y-6"
      >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {showBackButton && (
            <Link href="/profile">
              <Button variant="ghost" size="icon" className="rounded-full">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
          )}
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto">
          <TabsList className="grid w-full grid-cols-2 md:w-auto">
            <TabsTrigger value="active">
              {t("tabs.active")} ({tabCounts.active})
            </TabsTrigger>
            <TabsTrigger value="ended">
              {t("tabs.ended")} ({tabCounts.ended})
            </TabsTrigger>
          </TabsList>

          <Button asChild className="shrink-0">
            <Link href="/home">
              <TrendingUp className="w-4 h-4 mr-2" />
              {t("actions.browse")}
            </Link>
          </Button>
        </div>
      </div>

      <TabsContent value="active" className="mt-0">
        {activeBids.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeBids.map((bid) => (
              <BidCard key={bid.id} bid={bid} />
            ))}
          </div>
        ) : (
          <EmptyState type="active" />
        )}
      </TabsContent>

      <TabsContent value="ended" className="mt-0">
        {endedBids.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {endedBids.map((bid) => (
              <BidCard key={bid.id} bid={bid} />
            ))}
          </div>
        ) : (
          <EmptyState type="ended" />
        )}
      </TabsContent>
    </Tabs>
    </div>
  );
}

function BidCard({ bid }: { bid: Bid }) {
  const t = useTranslations("bids");
  const locale = useLocale();
  const dateLocale = locale === "fr" ? fr : enUS;

  const router = useRouter();
  const isEnded = new Date(bid.item.endTime) < new Date();
  const isWinning = bid.status === "WINNING";
  const isOutbid = bid.status === "OUTBID";
  const isWon = bid.status === "WON";
  const isLost = bid.status === "LOST";

  return (
    <div
      className="overflow-hidden group hover:shadow-xl transition-all duration-300 cursor-pointer flex flex-col h-full rounded-xl bg-card border border-border"
      onClick={() => router.push(`/auction/${bid.auctionId}`)}
    >
      {/* Image with Overlay - Full bleed at top */}
      <div className="relative aspect-16/10 w-full overflow-hidden">
        <Image
          src={bid.item.image}
          alt={bid.item.title}
          fill
          className={`object-cover transition-transform duration-500 group-hover:scale-110 ${isLost ? "grayscale-50" : ""}`}
        />
        {/* Dark gradient overlay */}
        <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/20 to-transparent" />

        {/* Status Badge */}
        <div className="absolute top-3 left-3">
          <StatusBadge status={bid.status} />
        </div>

        {/* Title on image */}
        <div className="absolute bottom-3 left-3 right-3">
          <h3 className="font-bold text-white text-base line-clamp-1 drop-shadow-md">
            {bid.item.title}
          </h3>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col flex-1 gap-3">
        {/* Bid Info Grid */}
        <div className="flex justify-between items-center gap-2 bg-muted/50 rounded-lg p-3">
          <div className="text-center flex-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
              {t("card.yourBid")}
            </p>
            <p
              className={`font-bold text-lg ${isWinning || isWon ? "text-green-500" : isOutbid ? "text-red-500" : ""}`}
            >
              {formatCurrency(bid.myBidAmount)}
            </p>
          </div>
          <div className="w-px h-8 bg-border" />
          <div className="text-center flex-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
              {t("card.highest")}
            </p>
            <p className="font-bold text-lg">
              {formatCurrency(bid.currentHighestBid)}
            </p>
          </div>
        </div>

        {/* Time & Action */}
        <div className="flex items-center justify-between mt-auto">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            <span suppressHydrationWarning>
              {isEnded
                ? `${t("card.ended")} ${formatDistanceToNow(bid.item.endTime, { addSuffix: true, locale: dateLocale })}`
                : formatDistanceToNow(bid.item.endTime, {
                  addSuffix: true,
                  locale: dateLocale,
                })}
            </span>
          </div>

          <div onClick={(e) => e.stopPropagation()}>
            <ActionButton bid={bid} />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: BidStatus }) {
  const t = useTranslations("bids");

  const config = {
    WINNING: {
      style: "bg-green-500/90 backdrop-blur-sm",
      label: t("status.winning"),
      icon: TrendingUp,
    },
    OUTBID: {
      style: "bg-red-500/90 backdrop-blur-sm",
      label: t("status.outbid"),
      icon: AlertTriangle,
    },
    WON: {
      style: "bg-blue-500/90 backdrop-blur-sm",
      label: t("status.won"),
      icon: Trophy,
    },
    LOST: {
      style: "bg-gray-500/90 backdrop-blur-sm",
      label: t("status.lost"),
      icon: XCircle,
    },
  };

  const { style, label } = config[status];

  return (
    <Badge
      className={`${style} text-white border-0 capitalize shadow-sm px-2 py-0.5 text-xs font-medium`}
    >
      {label}
    </Badge>
  );
}

function ActionButton({ bid }: { bid: Bid }) {
  const t = useTranslations("bids");
  const [showReviewModal, setShowReviewModal] = useState(false);

  switch (bid.status) {
    case "WINNING":
      return (
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-3 text-xs"
          asChild
        >
          <Link href={`/auction/${bid.auctionId}`}>{t("actions.view")}</Link>
        </Button>
      );
    case "OUTBID":
      return (
        <Button
          size="sm"
          className="h-8 px-3 text-xs bg-red-500 hover:bg-red-600"
          asChild
        >
          <Link href={`/auction/${bid.auctionId}`}>
            {t("actions.bidAgain")}
          </Link>
        </Button>
      );
    case "WON": {
      const isPaid =
        bid.order?.status === "paid" ||
        bid.order?.status === "shipped" ||
        bid.order?.status === "delivered";
      const isDelivered = bid.order?.status === "delivered";

      // Show Rate Seller button if order is delivered and not yet reviewed
      if (isDelivered) {
        // Already reviewed - show "Reviewed" badge
        if (bid.hasReviewedSeller) {
          return (
            <Badge
              variant="outline"
              className="h-8 px-3 text-xs bg-green-500/10 text-green-600 border-green-500/30"
            >
              <Star className="w-3.5 h-3.5 mr-1 fill-current" />
              {t("actions.reviewed")}
            </Badge>
          );
        }

        // Not reviewed yet - show Rate Seller button
        return (
          <>
            <Button
              size="sm"
              className="h-8 px-3 text-xs bg-yellow-500 hover:bg-yellow-600 text-black"
              onClick={(e) => {
                e.stopPropagation();
                setShowReviewModal(true);
              }}
            >
              <Star className="w-3.5 h-3.5 mr-1 fill-current" />
              {t("actions.rateSeller")}
            </Button>
            <CreateReviewModal
              isOpen={showReviewModal}
              onClose={() => setShowReviewModal(false)}
              targetUserId={bid.seller.id}
              targetUserName={bid.seller.name}
              listingId={bid.item.id}
            />
          </>
        );
      }

      return (
        <Button
          size="sm"
          className={`h-8 px-3 text-xs ${isPaid ? "bg-green-600 hover:bg-green-700" : "bg-blue-600 hover:bg-blue-700"}`}
          asChild
        >
          <Link href={`/checkout/won/${bid.auctionId}`}>
            {isPaid ? t("actions.viewOrder") : t("actions.checkout")}
          </Link>
        </Button>
      );
    }
    case "LOST":
      return (
        <Button variant="ghost" size="sm" className="h-8 px-3 text-xs" asChild>
          <Link href="/home">{t("actions.browse")}</Link>
        </Button>
      );
    default:
      return null;
  }
}

function EmptyState({ type }: { type: "active" | "ended" }) {
  const t = useTranslations("bids");

  return (
    <div className="text-center py-12 border rounded-lg bg-muted/10 border-dashed">
      <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
        <Trophy className="w-6 h-6 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium">
        {type === "active" ? t("empty.activeTitle") : t("empty.endedTitle")}
      </h3>
      <p className="text-muted-foreground mb-4">
        {type === "active" ? t("empty.activeDesc") : t("empty.endedDesc")}
      </p>
      {type === "active" && (
        <Button asChild>
          <Link href="/home">{t("actions.browse")}</Link>
        </Button>
      )}
    </div>
  );
}
