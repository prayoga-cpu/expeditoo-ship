"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useFormatter } from "next-intl";
import { useAuth } from "@/lib/auth-context";
import { useTabState } from "@/features/app/common/hooks";
import type { ReviewStats, ReviewTab, ReviewType } from "../types";

interface ReviewAuthor {
  id: string;
  name: string;
  image: string | null;
  isVerified: boolean;
}

interface ReviewListing {
  id: string;
  title: string;
}

interface ReviewFromAPI {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  /** The side of the delivery the **author** was on (`reviews.role`). */
  role: "shipper" | "carrier";
  author: ReviewAuthor;
  targetUser: ReviewAuthor;
  listing: ReviewListing | null;
}

interface ReviewsResponse {
  items: ReviewFromAPI[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface StatsResponse {
  average: number;
  total: number;
  distribution: { 1: number; 2: number; 3: number; 4: number; 5: number };
}

/**
 * Fetch reviews received by the current user
 */
async function fetchMyReviews(
  userId: string,
  page: number = 1
): Promise<ReviewsResponse> {
  const res = await fetch(`/api/users/${userId}/reviews?page=${page}&limit=50`);
  const data = await res.json();
  if (data.success) {
    return data.data;
  }
  return { items: [], total: 0, page: 1, limit: 50, totalPages: 0 };
}

/**
 * Fetch rating stats for the current user
 */
async function fetchMyStats(userId: string): Promise<StatsResponse> {
  const res = await fetch(`/api/users/${userId}/stats`);
  const data = await res.json();
  if (data.success) {
    return data.data;
  }
  return {
    average: 0,
    total: 0,
    distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  };
}

/**
 * The side the reviewed person was on: the opposite of the author's. A review
 * a requester (`shipper`) wrote rates the transporter, and the reverse.
 */
export function receivedAs(authorRole: "shipper" | "carrier"): ReviewType {
  return authorRole === "shipper" ? "carrier" : "requester";
}

/**
 * Custom hook for reviews data and filtering
 * Fetches real data from API
 */
/**
 * Custom hook for reviews data and filtering
 * Fetches real data from API
 * @param targetUserId - Optional user ID to fetch reviews for. Defaults to current logged-in user.
 */
export function useReviews(targetUserId?: string) {
  const { user } = useAuth();
  const { activeTab, setActiveTab } = useTabState<ReviewTab>("all");
  const format = useFormatter();

  // Determine which user ID to use (prop or current user)
  const userIdToFetch = targetUserId || user?.id;

  // Fetch reviews received by user
  const reviewsQuery = useQuery({
    queryKey: ["reviews", userIdToFetch],
    queryFn: () => fetchMyReviews(userIdToFetch!),
    enabled: !!userIdToFetch,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch stats for user
  const statsQuery = useQuery({
    queryKey: ["user-stats", userIdToFetch],
    queryFn: () => fetchMyStats(userIdToFetch!),
    enabled: !!userIdToFetch,
    staleTime: 5 * 60 * 1000,
  });

  // Transform API data to UI format
  const allReviews = useMemo(() => {
    if (!reviewsQuery.data?.items) return [];

    return reviewsQuery.data.items.map((review) => ({
      id: review.id,
      author: review.author.name,
      authorImage: review.author.image,
      authorVerified: review.author.isVerified,
      rating: review.rating,
      title: review.listing?.title ?? "",
      content: review.comment || "",
      timestamp: format.relativeTime(new Date(review.createdAt)),
      type: receivedAs(review.role),
      listingId: review.listing?.id,
    }));
  }, [reviewsQuery.data, format]);

  // Default stats
  const stats: ReviewStats = useMemo(
    () => ({
      average: statsQuery.data?.average || 0,
      total: statsQuery.data?.total || 0,
      distribution: statsQuery.data?.distribution || { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    }),
    [statsQuery.data]
  );

  // Filter reviews by tab
  const filteredReviews = useMemo(
    () =>
      allReviews.filter((review) => {
        if (activeTab === "all") return true;
        return review.type === activeTab;
      }),
    [allReviews, activeTab]
  );

  return {
    reviews: filteredReviews,
    allReviews,
    stats,
    activeTab,
    setActiveTab,
    isLoading: reviewsQuery.isLoading || statsQuery.isLoading,
    // « Aucun avis » is a claim; a read that failed must not make it (§4).
    isError: reviewsQuery.isError || statsQuery.isError,
    retry: () => {
      if (reviewsQuery.isError) void reviewsQuery.refetch();
      if (statsQuery.isError) void statsQuery.refetch();
    },
  };
}
