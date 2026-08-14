"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { JobCard } from "@/features/app/home/ui/JobCard";
import type { BoardJob } from "@/features/app/home/types";
import { Calendar, Package, Star, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { PageLoader } from "@/components/ui/page-loader";
import { LottieLoader } from "@/components/ui/lottie-loader";
import { useTranslations } from "next-intl";
import { Reviews } from "./Reviews";
import { startConversation } from "@/features/app/messages/api/conversations.api";

interface PublicUser {
  id: string;
  name: string;
  image: string | null;
  createdAt: string;
  roles: string[];
  isVerified: boolean;
  rating?: number;
  reviews?: number;
}

interface ApiListingItem {
  id: string;
  title: string;
  currentPrice?: number;
  startPrice?: number;
  images?: { url: string }[];
  endsAt?: string;
  category?: { name: string };
  size?: string;
  city?: string;
  lat?: number;
  lng?: number;
  status: string;
}

// Fetcher functions (per docs/rules.md §6 - typed fetchers)
async function fetchPublicUser(id: string): Promise<PublicUser> {
  const [userRes, statsRes] = await Promise.all([
    fetch(`/api/users/${id}`),
    fetch(`/api/users/${id}/stats`),
  ]);

  const userData = await userRes.json();
  const statsData = await statsRes.json();

  if (!userData.success) {
    throw new Error("User not found");
  }

  const fetchedUser = userData.data;

  // Merge stats if available
  if (statsData.success) {
    fetchedUser.rating = statsData.data.average;
    fetchedUser.reviews = statsData.data.total;
  }

  return fetchedUser;
}

async function fetchUserListings(id: string): Promise<BoardJob[]> {
  const res = await fetch(`/api/users/${id}/listings`);
  const data = await res.json();

  if (!data.success) return [];

  // The endpoint already returns open jobs only; this guards against one whose
  // bidding window lapsed between the query and the render.
  const now = Date.now();
  return (data.data as BoardJob[]).filter(
    (job) => new Date(job.expiresAt).getTime() > now
  );
}

export function PublicProfile({
  id,
  onBack,
}: {
  id: string;
  onBack?: () => void;
}) {
  const router = useRouter();
  const t = useTranslations("profile.public");
  const { user: currentUser } = useAuth();
  const [isMessageLoading, setIsMessageLoading] = useState(false);

  // Use TanStack Query for data fetching (per docs/rules.md §6)
  const { data: user, isLoading: isLoadingUser } = useQuery({
    queryKey: ["users", id],
    queryFn: () => fetchPublicUser(id),
    enabled: !!id,
  });

  const { data: listings = [], isLoading: isLoadingListings } = useQuery({
    queryKey: ["users", id, "listings"],
    queryFn: () => fetchUserListings(id),
    enabled: !!id,
  });

  const isLoading = isLoadingUser || isLoadingListings;

  const handleMessage = async () => {
    if (!currentUser) {
      toast.error(t("loginToMessage"));
      router.push("/signin");
      return;
    }

    if (currentUser.id === id) {
      toast.error(t("selfMessage"));
      return;
    }

    try {
      setIsMessageLoading(true);
      const { conversationId } = await startConversation(id);
      router.push(`/messages/${conversationId}`);
    } catch (error) {
      console.error("Message error:", error);
      toast.error(error instanceof Error ? error.message : t("messageError"));
    } finally {
      setIsMessageLoading(false);
    }
  };

  if (isLoading) {
    return <PageLoader className="min-h-[60vh]" />;
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <h1 className="text-2xl font-bold">{t("notFound")}</h1>
        <p className="text-muted-foreground">{t("notFoundDesc")}</p>
        <Button
          variant="outline"
          onClick={() => (onBack ? onBack() : router.back())}
        >
          {t("goBack")}
        </Button>
      </div>
    );
  }

  return (
    <div className="  mx-auto p-4 md:p-6 pb-24">
      <Button
        variant="ghost"
        size="sm"
        className="mb-6 -ml-2 gap-2"
        onClick={() => (onBack ? onBack() : router.back())}
      >
        <ArrowLeft className="w-4 h-4" />
        {t("back")}
      </Button>

      {/* Profile Header */}
      <Card className="mb-8">
        <CardContent className="p-6 md:p-8">
          <div className="flex flex-col md:flex-row gap-6 items-center md:items-center">
            <div className="relative">
              <Avatar className="w-24 h-24 md:w-32 md:h-32 border-4 border-background shadow-xl">
                <AvatarImage src={user.image || undefined} />
                <AvatarFallback className="text-2xl font-bold bg-linear-to-br from-primary to-accent-pink text-white">
                  {user.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="flex-1 text-center md:text-left">
              <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center justify-center md:justify-start gap-2">
                {user.name}
                {user.isVerified && <VerifiedBadge size={24} />}
              </h1>

              <div className="flex items-center gap-2 mb-4 justify-center md:justify-start mt-2">
                <div className="flex items-center text-yellow-500">
                  <Star className="w-4 h-4 fill-current mr-1" />
                  <span className="font-medium text-foreground">
                    {user.rating?.toFixed(1) || "0.0"}
                  </span>
                </div>
                <span className="text-muted-foreground">•</span>
                <span className="text-muted-foreground">
                  {t("reviews", { count: user.reviews || 0 })}
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-muted-foreground text-sm">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  <span>
                    {t("joined", {
                      date: format(new Date(user.createdAt), "MMMM yyyy"),
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Package className="w-4 h-4" />
                  <span>
                    {listings.length} {t("activeListings")}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              {currentUser?.id !== user.id && (
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={handleMessage}
                  disabled={isMessageLoading}
                >
                  {isMessageLoading ? (
                    <LottieLoader width={20} height={20} />
                  ) : (
                    <MessageSquare className="w-4 h-4" />
                  )}
                  {t("message")}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Listings Grid */}
      <div>
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
          <span className="w-2 h-8 bg-primary rounded-full" />
          {t("activeListings")}
        </h2>
        {listings.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {listings.map((listing) => (
              <JobCard
                key={listing.id}
                job={listing}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 bg-muted/30 rounded-xl border border-dashed gap-4">
            <Package className="w-12 h-12 text-muted-foreground/50" />
            <div className="text-center">
              <h3 className="font-semibold text-lg">{t("noListings")}</h3>
              <p className="text-muted-foreground">{t("noListingsDesc")}</p>
            </div>
          </div>
        )}
      </div>

      {/* Reviews Section */}
      <div className="mt-12">
        <Reviews userId={user.id} />
      </div>
    </div>
  );
}
