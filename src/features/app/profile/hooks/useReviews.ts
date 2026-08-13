"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { useTabState } from "@/features/app/common/hooks";
import type { ReviewStats, ReviewTab } from "../types";

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
 * Format date to relative time string
 */
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
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

  // Determine which user ID to use (prop or current user)
  const userIdToFetch = targetUserId || user?.id;

  // Fetch reviews received by user
  const { data: reviewsData, isLoading: isLoadingReviews } = useQuery({
    queryKey: ["reviews", userIdToFetch],
    queryFn: () => fetchMyReviews(userIdToFetch!),
    enabled: !!userIdToFetch,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch stats for user
  const { data: statsData, isLoading: isLoadingStats } = useQuery({
    queryKey: ["user-stats", userIdToFetch],
    queryFn: () => fetchMyStats(userIdToFetch!),
    enabled: !!userIdToFetch,
    staleTime: 5 * 60 * 1000,
  });

  // Transform API data to UI format
  const allReviews = useMemo(() => {
    if (!reviewsData?.items) return [];

    return reviewsData.items.map((review) => ({
      id: review.id,
      author: review.author.name,
      authorImage: review.author.image,
      authorVerified: review.author.isVerified,
      rating: review.rating,
      title: review.listing?.title || "Transaction",
      content: review.comment || "",
      timestamp: formatRelativeTime(review.createdAt),
      type: "buyer" as "buyer" | "seller",
      helpful: 0,
      listingId: review.listing?.id,
    }));
  }, [reviewsData]);

  // Default stats
  const stats: ReviewStats = useMemo(
    () => ({
      average: statsData?.average || 0,
      total: statsData?.total || 0,
      distribution: statsData?.distribution || { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    }),
    [statsData]
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
    isLoading: isLoadingReviews || isLoadingStats,
  };
}
