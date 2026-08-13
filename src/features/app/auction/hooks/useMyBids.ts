import type { AblySubscriptionRef, AblyMessage, AblyRealtimeChannel } from "@/types/ably.types";
import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useAblyAvailable,
  useAblyClientContext,
} from "@/components/providers/AblyProvider";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import type { OutbidEvent } from "@/server/dto/ably-events.dto";

export type BidStatus = "WINNING" | "OUTBID" | "WON" | "LOST";

export interface Bid {
  id: string;
  auctionId: string;
  item: {
    id: string;
    title: string;
    image: string;
    endTime: Date;
  };
  seller: {
    id: string;
    name: string;
  };
  myBidAmount: number;
  currentHighestBid: number;
  status: BidStatus;
  order?: {
    id: string;
    status: string;
  } | null;
  hasReviewedSeller: boolean;
}

interface ApiBid {
  id: string;
  auctionId: string;
  item: {
    id: string;
    title: string;
    image: string;
    endTime: string | null;
  };
  seller: {
    id: string;
    name: string;
  };
  myBidAmount: number;
  currentHighestBid: number;
  status: BidStatus;
  order?: {
    id: string;
    status: string;
  } | null;
  hasReviewedSeller: boolean;
}

async function fetchMyBids(): Promise<Bid[]> {
  const res = await fetch("/api/user/bids");
  const data = await res.json();

  if (!data.success) {
    throw new Error(data.error?.message || "Failed to fetch bids");
  }

  // Transform dates
  return data.data.map((bid: ApiBid) => ({
    ...bid,
    item: {
      ...bid.item,
      endTime: bid.item.endTime ? new Date(bid.item.endTime) : new Date(),
    },
    seller: bid.seller,
    // Keep amounts in cents - formatCurrency will handle the conversion
    myBidAmount: bid.myBidAmount,
    currentHighestBid: bid.currentHighestBid,
    order: bid.order,
    hasReviewedSeller: bid.hasReviewedSeller,
  }));
}

export function useMyBids() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isAblyAvailable = useAblyAvailable();
  const ablyClient = useAblyClientContext();
  const subscriptionRef = useRef<AblySubscriptionRef | null>(null);

  // Subscribe to real-time outbid notifications
  useEffect(() => {
    if (!ablyClient || !user?.id) return;

    // Check connection state
    const state = ablyClient.connection.state;
    if (state === "closed" || state === "closing" || state === "failed") {
      return;
    }

    try {
      const channel = ablyClient.channels.get(`user:${user.id}:bids`) as unknown as AblyRealtimeChannel;

      const handleOutbid = (message: AblyMessage) => {
        // Invalidate bids query to refetch latest status
        queryClient.invalidateQueries({ queryKey: ["my-bids"] });

        // Show toast notification
        const data = message.data as OutbidEvent;
        const listingTitle = data?.listingTitle || "an auction";
        toast.warning(`You've been outbid on ${listingTitle}!`);
      };

      channel.subscribe("bid:outbid", handleOutbid);
      subscriptionRef.current = { channel, handler: handleOutbid };
    } catch (error) {
      console.error("[useMyBids] Failed to subscribe:", error);
    }

    return () => {
      if (subscriptionRef.current?.channel) {
        try {
          subscriptionRef.current.channel.unsubscribe(
            "bid:outbid",
            subscriptionRef.current.handler
          );
        } catch {
          // Ignore - channel may be detached
        }
        subscriptionRef.current = null;
      }
    };
  }, [ablyClient, user?.id, queryClient]);

  const {
    data: bids = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["my-bids"],
    queryFn: fetchMyBids,
    staleTime: isAblyAvailable ? Infinity : 1000 * 60 * 2,
    // Poll as fallback when Ably is not available
    refetchInterval: isAblyAvailable ? false : 1000 * 30,
  });

  return {
    bids,
    isLoading,
    isError,
    filter: "ALL" as const, // Kept for backward compatibility
    setFilter: () => { }, // No-op, filtering done in UI
    counts: {
      ALL: bids.length,
      WINNING: bids.filter((b) => b.status === "WINNING").length,
      OUTBID: bids.filter((b) => b.status === "OUTBID").length,
      WON: bids.filter((b) => b.status === "WON").length,
      LOST: bids.filter((b) => b.status === "LOST").length,
    },
  };
}
