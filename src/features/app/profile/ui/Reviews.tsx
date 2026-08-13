"use client";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ReviewCard } from "./ReviewCard";
import { RatingStars } from "@/components/RatingStars";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useReviews } from "../hooks/useReviews";
import { PageLoader } from "@/components/ui/page-loader";
import type { ReviewTab } from "../types";
import { useTranslations } from "next-intl";

import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export function Reviews({ userId }: { userId?: string }) {
  const t = useTranslations("profile.reviews");
  const { reviews, stats, activeTab, setActiveTab, allReviews, isLoading } =
    useReviews(userId);
  
  const searchParams = useSearchParams();
  const showBackButton = searchParams.get("from") === "profile";
  const pathname = usePathname();
  const isDriver = pathname?.includes("/driver");

  if (isLoading) {
    return (
      <PageLoader
        variant="default"
        className={cn(isDriver && "xl:min-h-[100vh]")}
      />
    );
  }

  return (
    <div className="w-full mx-auto px-4 md:px-6 md:py-6 pb-24 md:pb-6">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm flex items-center gap-3 py-4 md:py-6 md:static md:bg-transparent -mx-4 px-4 md:mx-0 md:px-0 border-b md:border-b-0 border-border/40">
        {showBackButton && (
          <Link href="/profile">
            <Button variant="ghost" size="icon" className="rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
        )}
        <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-foreground">
          {t("title")}
        </h1>
      </div>

      {/* Rating Summary */}
      <div className="bg-card rounded-xl border border-border p-4 md:p-6 mb-4 md:mb-6 mt-4">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          {/* Average Rating */}
          <div className="text-center md:text-left md:pr-6 md:border-r border-border">
            <div className="text-5xl md:text-4xl font-bold text-primary mb-2">
              {stats.average}
            </div>
            <RatingStars rating={Math.round(stats.average)} />
            <p className="text-xs text-muted-foreground mt-2">
              {t("summary.totalReviews", { count: stats.total })}
            </p>
          </div>

          {/* Rating Distribution */}
          <div className="flex-1">
            {[5, 4, 3, 2, 1].map((star) => (
              <div
                key={star}
                className="flex items-center gap-2 md:gap-3 text-xs mb-1.5"
              >
                <span className="w-5 text-muted-foreground font-medium">
                  {star}★
                </span>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-yellow-400 transition-all duration-300"
                    style={{
                      width: `${stats.total > 0 ? (stats.distribution[star as keyof typeof stats.distribution] / stats.total) * 100 : 0}%`,
                    }}
                  />
                </div>
                <span className="w-8 text-right text-muted-foreground font-medium">
                  {stats.distribution[star as keyof typeof stats.distribution]}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 md:mb-6">
        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as ReviewTab)}
        >
          <TabsList className="w-full justify-start bg-transparent p-0 h-auto gap-2 border-0">
            <TabsTrigger
              value="all"
              className="px-4 py-2.5 rounded-lg font-medium text-sm text-muted-foreground data-[state=active]:text-primary data-[state=active]:bg-primary/8 border border-transparent data-[state=active]:border-primary/20 transition-all duration-200 hover:bg-muted/50"
            >
              {t("tabs.all")}
              <Badge variant="outline" className="ml-2 text-xs">
                {stats.total}
              </Badge>
            </TabsTrigger>
            <TabsTrigger
              value="buyer"
              className="px-4 py-2.5 rounded-lg font-medium text-sm text-muted-foreground data-[state=active]:text-primary data-[state=active]:bg-primary/8 border border-transparent data-[state=active]:border-primary/20 transition-all duration-200 hover:bg-muted/50"
            >
              {t("tabs.buyer")}
              <Badge variant="outline" className="ml-2 text-xs">
                {allReviews.filter((r) => r.type === "buyer").length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger
              value="seller"
              className="px-4 py-2.5 rounded-lg font-medium text-sm text-muted-foreground data-[state=active]:text-primary data-[state=active]:bg-primary/8 border border-transparent data-[state=active]:border-primary/20 transition-all duration-200 hover:bg-muted/50"
            >
              {t("tabs.seller")}
              <Badge variant="outline" className="ml-2 text-xs">
                {allReviews.filter((r) => r.type === "seller").length}
              </Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Reviews List */}
      <div className="space-y-3 md:space-y-4">
        {reviews.length > 0 ? (
          reviews.map((review) => <ReviewCard key={review.id} {...review} />)
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              {t("empty")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
