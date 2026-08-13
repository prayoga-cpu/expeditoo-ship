import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Review } from "@/db/schema/reviews";

interface ReviewAuthor {
  id: string;
  name: string;
  image: string | null;
}

interface ApiReview extends Review {
  author: ReviewAuthor;
}

async function fetchListingReviews(listingId: string) {
  const res = await fetch(`/api/listings/${listingId}/reviews`);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error?.message || "Failed to fetch reviews");
  return body.data as ApiReview[];
}

export function useListingReviews(listingId: string) {
  const [activeTab, setActiveTab] = useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["listing-reviews", listingId],
    queryFn: () => fetchListingReviews(listingId),
    enabled: !!listingId,
  });

  const reviews = useMemo(() => {
    if (!data) return [];

    return data.map((review) => ({
      id: review.id,
      author: review.author.name,
      authorImage: review.author.image,
      rating: review.rating,
      title: "Review", // Reviews don't necessarily have titles in DB, using generic
      content: review.comment || "",
      timestamp: new Date(review.createdAt).toLocaleDateString(), // Simple formatting
      type: "buyer" as const, // For listing reviews, usually buyers reviewing items. 
      // Logic can be refined based on role if needed (e.g. if we show Seller reviews here too)
      helpful: 0,
    }));
  }, [data]);

  return {
    reviews,
    isLoading,
    activeTab,
    setActiveTab,
  };
}
