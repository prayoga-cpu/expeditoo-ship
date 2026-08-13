import type { AblySubscriptionRef, AblyRealtimeChannel } from "@/types/ably.types";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAblyAvailable, useAblyClientContext } from "@/components/providers/AblyProvider";

interface ApiBid {
  id: string;
  listingId: string;
  bidderId: string;
  amount: number;
  createdAt: string;
  bidder: {
    id: string;
    name: string | null;
    image: string | null;
  };
}

interface ApiListing {
  id: string;
  title: string;
  description: string;
  images: { url: string }[];
  category: { name: string } | null;
  condition: string;
  currentPrice: number | null;
  startPrice: number | null;
  endsAt: string | null;
  status: string;
  address: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  buyNowPrice: number | null;
  seller: {
    id: string;
    name: string | null;
    image: string | null;
    isVerified: boolean;
  } | null;
}

export function useAuctionDetail(id: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isAblyAvailable = useAblyAvailable();
  const ablyClient = useAblyClientContext();
  const subscriptionRef = useRef<AblySubscriptionRef | null>(null);

  const [bidAmount, setBidAmount] = useState("");

  // Fetch listing data
  const [listingData, setListingData] = useState<ApiListing | null>(null);
  const [deadline, setDeadline] = useState<string>("");

  // Subscribe to real-time bid updates for this auction
  // OPTIMIZATION: Detach channel when tab is hidden to save Ably quota
  useEffect(() => {
    if (!ablyClient || !id) return;

    let channel: ReturnType<typeof ablyClient.channels.get> | null = null;
    let isSubscribed = false;
    let isMounted = true; // Flag to prevent subscribe after cleanup

    const handleNewBid = () => {
      queryClient.invalidateQueries({ queryKey: ["bids", id] });
    };

    const handleAuctionEnded = () => {
      queryClient.invalidateQueries({ queryKey: ["bids", id] });
      toast.info("Auction has ended!");
    };

    const subscribe = async () => {
      // Don't subscribe if already subscribed, unmounted, or no client
      if (isSubscribed || !isMounted || !ablyClient) return;

      const state = ablyClient.connection.state;
      if (state === "closed" || state === "closing" || state === "failed") {
        return;
      }

      try {
        channel = ablyClient.channels.get(`listing:${id}:bids`);

        // Wait for channel to be attached before subscribing
        await channel.attach();

        // Double-check we're still mounted after async operation
        if (!isMounted) {
          // Do not detach here as it causes race conditions with new effects using the same channel instance
          return;
        }

        channel.subscribe("bid:new", handleNewBid);
        channel.subscribe("auction:ended", handleAuctionEnded);
        isSubscribed = true;

        subscriptionRef.current = {
          channel: channel as unknown as AblyRealtimeChannel,
          handlers: [
            { event: "bid:new", handler: handleNewBid },
            { event: "auction:ended", handler: handleAuctionEnded },
          ]
        };
      } catch (error) {
        // Ignore "Detach request superseded" errors - these are expected during React Strict Mode remounts
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (!errorMessage.includes("superseded") && !errorMessage.includes("detach")) {
          console.error("[useAuctionDetail] Failed to subscribe:", error);
        }
      }
    };

    const unsubscribe = () => {
      if (!channel) return;

      try {
        // Only unsubscribe handlers, don't detach channel (prevents race condition)
        channel.unsubscribe("bid:new", handleNewBid);
        channel.unsubscribe("auction:ended", handleAuctionEnded);
      } catch {
        // Ignore unsubscribe errors
      }
      isSubscribed = false;
      subscriptionRef.current = null;
    };

    // Visibility change handler - save channels when tab is hidden
    const handleVisibilityChange = () => {
      if (document.hidden) {
        unsubscribe();
        // Only detach when user leaves tab (not on cleanup)
        if (channel) {
          channel.detach().catch(() => { });
        }
      } else if (isMounted) {
        subscribe();
        // Refetch to catch up on missed bids
        queryClient.invalidateQueries({ queryKey: ["bids", id] });
      }
    };

    // Initial subscribe (only if tab is visible)
    if (!document.hidden) {
      subscribe();
    }

    // Listen for visibility changes
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isMounted = false; // Mark as unmounted to prevent new subscriptions
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      unsubscribe();
    };
  }, [ablyClient, id, queryClient]);

  // Fetch listing
  useEffect(() => {
    const fetchListing = async () => {
      try {
        const res = await fetch(`/api/listings/${id}`);
        const data = await res.json();
        if (data.success) {
          setListingData(data.data);
          if (data.data.endsAt) {
            setDeadline(data.data.endsAt);
          }
        } else {
             console.error("[useAuctionDetail] Fetch success=false", data);
        }
      } catch (error) {
        console.error("[useAuctionDetail] Failed to fetch listing:", error);
      }
    };

    if (id) {
      fetchListing();
    }
  }, [id]);

  // Fetch bid history from API (poll as fallback when Ably not available)
  const { data: bidsData } = useQuery({
    queryKey: ["bids", id],
    queryFn: async () => {
      const res = await fetch(`/api/auctions/${id}/bids`);
      const data = await res.json();
      if (data.success) {
        return data.data as ApiBid[];
      }
      return [];
    },
    enabled: !!id,
    // Poll every 10s as fallback when Ably not available
    refetchInterval: isAblyAvailable ? false : 10000,
    staleTime: isAblyAvailable ? Infinity : 5000,
  });

  // Transform API bids to UI format
  const bids = useMemo(() => {
    if (!bidsData) return [];
    return bidsData.map((bid) => ({
      bidder: bid.bidder?.name || "Anonymous",
      amount: bid.amount / 100,
      time: formatTimeAgo(new Date(bid.createdAt)),
      avatar: bid.bidder?.name?.charAt(0).toUpperCase() || "?",
      image: bid.bidder?.image || null,
    }));
  }, [bidsData]);

  // Place bid mutation
  const placeBidMutation = useMutation({
    mutationFn: async (amount: number) => {
      const res = await fetch(`/api/auctions/${id}/bid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Math.round(amount * 100) }), // Convert to cents
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error?.message || "Failed to place bid");
      }
      return data.data;
    },
    onSuccess: () => {
      // Refetch bids after successful bid
      queryClient.invalidateQueries({ queryKey: ["bids", id] });
      setBidAmount("");
      toast.success("Bid placed successfully!");

      // Soft Timer Logic: Extend if within last 100 seconds
      const now = Date.now();
      const end = new Date(deadline).getTime();
      const remaining = end - now;

      if (remaining < 100 * 1000 && remaining > 0) {
        const newDeadline = new Date(end + 60 * 1000).toISOString();
        setDeadline(newDeadline);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Map API data to UI format
  const auction = useMemo(() => {
    if (!listingData) return null;

    return {
      id: listingData.id,
      title: listingData.title,
      description: listingData.description,
      image:
        listingData.images?.[0]?.url ||
        "https://placehold.co/600x400?text=No+Image",
      images: listingData.images?.map((img: { url: string }) => img.url) || [],
      category: listingData.category?.name || "Uncategorized",
      condition: listingData.condition,
      currentBid:
        (listingData.currentPrice || listingData.startPrice || 0) / 100,
      // Add buyNowPrice provided by API, convert cents to euros
      buyNowPrice: listingData.buyNowPrice ? listingData.buyNowPrice / 100 : null,
      deadline: listingData.endsAt || deadline,
      status: listingData.status,
      minimumIncrease: 5,
      bidCount: bids.length,
      location: {
        address: listingData.address || "No address",
        city: listingData.city || "Unknown City",
        zip: "",
        lat: listingData.lat || 48.8566,
        lng: listingData.lng || 2.3522,
      },
      seller: {
        id: listingData.seller?.id || "",
        name: listingData.seller?.name || "Unknown Seller",
        rating: 0,
        reviews: 0,
        joined: "2024",
        avatar: listingData.seller?.image || null,
        isVerified: listingData.seller?.isVerified || false,
      },
    };
  }, [listingData, bids.length, deadline]);

  // Countdown Logic
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    if (!deadline) return;

    const timer = setInterval(() => {
      const now = new Date().getTime();
      const end = new Date(deadline).getTime();
      const distance = end - now;

      if (distance < 0) {
        clearInterval(timer);
        setTimeLeft("Auction Ended");
        return;
      }

      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor(
        (distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
      );
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      if (days > 0) {
        setTimeLeft(`${days}d ${hours}h ${minutes}m`);
      } else {
        setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [deadline]);

  // Get current highest bid from API data or listing
  const currentHighestBid = useMemo(() => {
    if (bidsData && bidsData.length > 0) {
      return bidsData[0].amount / 100;
    }
    return auction?.currentBid || 0;
  }, [bidsData, auction?.currentBid]);

  const handlePlaceBid = useCallback(() => {
    const amount = Number(bidAmount);
    if (amount > currentHighestBid) {
      placeBidMutation.mutate(amount);
    }
  }, [bidAmount, currentHighestBid, placeBidMutation]);

  // Check if current user is the listing owner
  const isOwnListing = useMemo(() => {
    if (!user || !auction) return false;
    return user.id === auction.seller.id;
  }, [user, auction]);

  return {
    auction,
    bids,
    bidAmount,
    setBidAmount,
    timeLeft,
    currentHighestBid,
    handlePlaceBid,
    isOwnListing,
    isPlacingBid: placeBidMutation.isPending,
  };
}

// Helper function to format time ago
function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  return `${diffDay}d ago`;
}
