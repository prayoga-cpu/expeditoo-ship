"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { useAblyClientContext } from "@/components/providers/AblyProvider";
import { useActiveConversation } from "@/features/app/messages/context";
import { AblyMessage } from "@/types/ably.types";
import type { RealtimeChannel } from "ably";

/**
 * Global Ably Subscriptions Component
 *
 * OPTIMIZED: Single Channel Pattern
 * All user-specific events go through ONE channel: user:{userId}:stream
 * This reduces channel usage from 2 per user to 1, doubling free tier capacity.
 *
 * Event Types:
 * - badge:update     - Message badge count update (arrives FIRST)
 * - data:update      - Dashboard/data refresh signal (arrives FIRST)
 * - bid:outbid       - User was outbid (arrives FIRST)
 * - notification:new - Notification alert (arrives LAST)
 *
 * ORDER MATTERS: Data events arrive before notification events
 * so UI can update data before showing the notification.
 */
export function AblySubscriptions() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const client = useAblyClientContext();
  const { activeConversationId } = useActiveConversation();

  // Use ref to access latest activeConversationId in callback without re-subscribing
  const activeConversationRef = useRef(activeConversationId);
  useEffect(() => {
    activeConversationRef.current = activeConversationId;
  }, [activeConversationId]);

  // Track subscription for cleanup
  const subscriptionRef = useRef<{
    channel: RealtimeChannel | null;
    handleEvent: (message: AblyMessage) => void;
  } | null>(null);

  useEffect(() => {
    // Need both user and client to subscribe
    if (!user?.id || !client) {
      // Cleanup if we had subscription
      if (subscriptionRef.current?.channel) {
        try {
          subscriptionRef.current.channel.unsubscribe();
        } catch {
          // Ignore - channel may be detached
        }
        subscriptionRef.current = null;
      }
      return;
    }

    // Check if client connection is usable
    const state = client.connection.state;
    if (state === "closed" || state === "closing" || state === "failed") {
      return;
    }

    /**
     * Single event handler for all user stream events.
     * Dispatches to appropriate handler based on event name.
     */
    const handleEvent = (message: AblyMessage) => {
      const eventName = message.name;

      switch (eventName) {
        case "badge:update":
          handleMessageBadge(message);
          break;

        case "data:update":
          handleDataUpdate(message);
          break;

        case "bid:outbid":
          handleOutbid(message);
          break;

        case "notification:new":
          handleNotification();
          break;

        default:
          console.log("[AblySubscriptions] Unknown event:", eventName);
      }
    };

    /**
     * Handle message badge update
     */
    const handleMessageBadge = (message: AblyMessage) => {
      const data = message.data as {
        unreadCount?: number;
        conversationId?: string;
      };
      const currentActive = activeConversationRef.current;

      // If user is currently viewing this conversation, ignore the unread count from event
      if (data?.conversationId && data.conversationId === currentActive) {
        setTimeout(() => {
          queryClient.refetchQueries({
            queryKey: ["messages", "unread-count"],
            type: "all",
          });
        }, 300);
        return;
      }

      // Instantly update cache with data from event
      if (typeof data?.unreadCount === "number") {
        queryClient.setQueryData(
          ["messages", "unread-count"],
          data.unreadCount
        );
      }

      // Invalidate conversations list
      queryClient.invalidateQueries({
        queryKey: ["messages", "conversations"],
      });
    };

    /**
     * Handle data/dashboard update signal
     * Triggers refetch of relevant data based on type
     */
    const handleDataUpdate = (message: AblyMessage) => {
      const data = message.data as { type: string; resourceId?: string };

      switch (data.type) {
        case "shipment":
          queryClient.invalidateQueries({ queryKey: ["shipments"] });
          queryClient.invalidateQueries({ queryKey: ["deliveries"] });
          if (data.resourceId) {
            queryClient.invalidateQueries({
              queryKey: ["shipment", data.resourceId],
            });
          }
          break;

        case "order":
          queryClient.invalidateQueries({ queryKey: ["orders"] });
          // Invalidate specific order if resourceId provided
          if (data.resourceId) {
            queryClient.invalidateQueries({
              queryKey: ["order", data.resourceId],
            });
          }
          // Also invalidate order-by-listing queries (used in checkout)
          queryClient.invalidateQueries({ queryKey: ["order", "listing"] });
          break;

        case "proposal":
          queryClient.invalidateQueries({ queryKey: ["proposals"] });
          queryClient.invalidateQueries({ queryKey: ["shipments"] });
          break;

        case "listing":
          queryClient.invalidateQueries({ queryKey: ["listings"] });
          break;

        default:
          // Ignore unknown types - don't invalidate anything
          console.log(
            "[AblySubscriptions] Unknown data:update type:",
            data.type
          );
      }
    };

    /**
     * Handle outbid notification
     */
    const handleOutbid = (message: AblyMessage) => {
      const data = message.data as { listingId?: string };

      // Refetch the specific listing bid data
      if (data.listingId) {
        queryClient.invalidateQueries({
          queryKey: ["listing", data.listingId],
        });
        queryClient.invalidateQueries({ queryKey: ["bids", data.listingId] });
      }

      // Also refetch user's bids
      queryClient.invalidateQueries({ queryKey: ["my-bids"] });
    };

    /**
     * Handle new notification
     * This is called LAST after data events, so UI is already updated
     */
    const handleNotification = () => {
      queryClient.refetchQueries({ queryKey: ["notifications"], type: "all" });
      queryClient.refetchQueries({
        queryKey: ["notifications", "unread-count"],
        type: "all",
      });
    };

    // Subscribe to single user stream channel
    try {
      const channel = client.channels.get(`user:${user.id}:stream`);

      // Subscribe to ALL events on this channel
      channel.subscribe(handleEvent);

      // Store for cleanup
      subscriptionRef.current = { channel, handleEvent };
    } catch (error) {
      console.error("[AblySubscriptions] Failed to subscribe:", error);
    }

    // Cleanup
    return () => {
      if (subscriptionRef.current?.channel) {
        try {
          subscriptionRef.current.channel.unsubscribe();
        } catch {
          // Ignore - channel may be detached or client closed
        }
        subscriptionRef.current = null;
      }
    };
  }, [user?.id, client, queryClient]);

  // This component doesn't render anything
  return null;
}
