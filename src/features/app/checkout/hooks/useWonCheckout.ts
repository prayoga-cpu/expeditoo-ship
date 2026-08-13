import type {
  AblySubscriptionRef,
  AblyMessage,
  OrderStatusData,
  AblyRealtimeChannel,
} from "@/types/ably.types";
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import {
  useAblyAvailable,
  useAblyClientContext,
} from "@/components/providers/AblyProvider";
import { toast } from "sonner";

export interface WonOrderData {
  id: string;
  status: string;
  listingId: string;
  listing: {
    id: string;
    title: string;
    address: string | null;
    lat: number | null;
    lng: number | null;
    images?: { url: string }[];
  } | null;
  seller: {
    id: string;
    name: string | null;
    image: string | null;
  } | null;
  shipment: {
    id: string;
    status: string;
    driverId: string | null;
    price: number | null;
    destinationLat: number | null;
    destinationLng: number | null;
    driver: {
      id: string;
      name: string | null;
      image: string | null;
    } | null;
  } | null;
  itemPrice: number;
  shippingPrice: number | null;
  totalPrice: number | null;
  deliveryAddress: string | null;
  originAddress?: string | null;
  createdAt: string;
}

export function useWonCheckout(listingId: string) {
  const queryClient = useQueryClient();
  const isAblyAvailable = useAblyAvailable();
  const ablyClient = useAblyClientContext();
  const subscriptionRef = useRef<AblySubscriptionRef | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<
    "idle" | "processing" | "success" | "error"
  >("idle");

  // Fetch order data (poll as fallback when Ably not available)
  const {
    data: order,
    isLoading,
    error,
  } = useQuery<WonOrderData>({
    queryKey: ["order", "listing", listingId],
    queryFn: async () => {
      const res = await fetch(`/api/orders/listing/${listingId}`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to fetch order");
      }
      const data = await res.json();
      return data.data;
    },
    enabled: !!listingId,
    // Poll as fallback when Ably is not available
    refetchInterval: isAblyAvailable ? false : 10000,
    staleTime: isAblyAvailable ? Infinity : 5000,
  });

  // Subscribe to real-time order status updates
  // Uses per-order channel for clean separation and multi-party tracking
  useEffect(() => {
    if (!ablyClient || !order?.id) return;

    let channel: ReturnType<typeof ablyClient.channels.get> | null = null;
    let isMounted = true;

    const handleStatusUpdate = (message: AblyMessage) => {
      // Invalidate order query to refetch latest status
      queryClient.invalidateQueries({
        queryKey: ["order", "listing", listingId],
      });

      // Show toast for status change
      const data = message.data as OrderStatusData;
      if (data?.status) {
        toast.info(`Order status updated: ${data.status}`);
      }
    };

    const subscribe = async () => {
      if (!isMounted || !ablyClient) return;

      // Check connection state
      const state = ablyClient.connection.state;
      if (state === "closed" || state === "closing" || state === "failed") {
        return;
      }

      try {
        channel = ablyClient.channels.get(`order:${order.id}:status`);

        // Wait for channel to be attached before subscribing
        await channel.attach();

        // Double-check we're still mounted after async operation
        if (!isMounted) {
          channel.detach().catch(() => {});
          return;
        }

        if (channel) {
          channel.subscribe("order:status", handleStatusUpdate);
          subscriptionRef.current = {
            channel: channel as unknown as AblyRealtimeChannel,
            handler: handleStatusUpdate,
          };
        }
      } catch (error) {
        // Ignore "Detach request superseded" errors - expected during React remounts
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        if (
          !errorMessage.includes("superseded") &&
          !errorMessage.includes("detach")
        ) {
          console.error("[useWonCheckout] Failed to subscribe:", error);
        }
      }
    };

    subscribe();

    return () => {
      isMounted = false;
      if (subscriptionRef.current && subscriptionRef.current.channel) {
        try {
          subscriptionRef.current.channel.unsubscribe(
            "order:status",
            subscriptionRef.current.handler
          );
          // Don't detach on cleanup - prevents race condition
        } catch {
          // Ignore - channel may be detached
        }
        subscriptionRef.current = null;
      }
    };
  }, [ablyClient, order?.id, listingId, queryClient]);

  // Set delivery address mutation
  const setAddressMutation = useMutation({
    mutationFn: async (data: {
      address: string;
      lat?: string;
      lng?: string;
    }) => {
      if (!order?.id) throw new Error("Order not found");
      const res = await fetch(`/api/orders/${order.id}/address`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to set address");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["order", "listing", listingId],
      });
    },
  });

  // Confirm payment mutation
  const confirmPaymentMutation = useMutation({
    mutationFn: async () => {
      if (!order?.id) throw new Error("Order not found");
      setPaymentStatus("processing");
      const res = await fetch(`/api/orders/${order.id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Payment failed");
      }
      return res.json();
    },
    onSuccess: () => {
      setPaymentStatus("success");
      queryClient.invalidateQueries({
        queryKey: ["order", "listing", listingId],
      });
    },
    onError: () => {
      setPaymentStatus("error");
    },
  });

  // Computed values
  const canSetAddress = order?.status === "pending_address";
  const canPay = order?.status === "pending_payment";
  const isWaitingForProposals = order?.status === "pending_proposals";
  const isWaitingForSelection = order?.status === "pending_selection";
  const isPaid =
    order?.status === "paid" ||
    order?.status === "shipped" ||
    order?.status === "delivered";
  const isDelivered = order?.status === "delivered";

  const itemImage = order?.listing?.images?.[0]?.url || null;
  const formattedItemPrice = order
    ? (order.itemPrice / 100).toFixed(2)
    : "0.00";
  const formattedShippingPrice = order?.shippingPrice
    ? (order.shippingPrice / 100).toFixed(2)
    : null;
  const formattedTotalPrice = order?.totalPrice
    ? (order.totalPrice / 100).toFixed(2)
    : null;

  return {
    order,
    isLoading,
    error,
    paymentStatus,
    setPaymentStatus,

    // Actions
    setDeliveryAddress: setAddressMutation.mutate,
    isSettingAddress: setAddressMutation.isPending,
    addressError: setAddressMutation.error,

    confirmPayment: confirmPaymentMutation.mutate,
    isConfirmingPayment: confirmPaymentMutation.isPending,
    paymentError: confirmPaymentMutation.error,

    // Status helpers
    canSetAddress,
    canPay,
    isWaitingForProposals,
    isWaitingForSelection,
    isPaid,
    isDelivered,

    // Formatted values
    itemImage,
    formattedItemPrice,
    formattedShippingPrice,
    formattedTotalPrice,
  };
}
