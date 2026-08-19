import type { AblySubscriptionRef, AblyMessage, AblyRealtimeChannel } from "@/types/ably.types";
import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { messagesApi, type ThreadResponse, type MessageResponse } from "../api";
import type { ChatMessage, Conversation } from "../types";
import { useAblyClientContext } from "@/components/providers/AblyProvider";
import { useAuth } from "@/lib/auth-context";
import { useActiveConversation } from "../context";
import type { NewMessageEvent } from "@/server/dto/ably-events.dto";
import { namespaced } from "@/lib/env";

/**
 * Custom hook for managing message detail/chat conversation
 * Uses TanStack Query for data fetching and mutations
 * Real-time updates via Ably subscription to conversation channel
 * Implements optimistic updates for instant UI feedback
 *
 * @param conversationId - Conversation ID
 */
export function useMessageDetail(conversationId: string) {
  const queryClient = useQueryClient();
  const t = useTranslations("messages.detail");
  const locale = useLocale();
  const [inputValue, setInputValue] = useState("");
  const ablyClient = useAblyClientContext();
  const subscriptionRef = useRef<AblySubscriptionRef | null>(null);
  const { user } = useAuth();
  const { setActiveConversationId } = useActiveConversation();

  // Track which conversation is currently open (for badge logic)
  useEffect(() => {
    setActiveConversationId(conversationId);
    return () => setActiveConversationId(null);
  }, [conversationId, setActiveConversationId]);

  // Refetch unread count when entering chat (after markAsRead from getThread)
  useEffect(() => {
    const timer = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ["messages", "unread-count"] });
    }, 500);
    return () => clearTimeout(timer);
  }, [conversationId, queryClient]);

  // Subscribe to real-time message updates for this conversation
  useEffect(() => {
    if (!ablyClient || !conversationId || !user?.id) return;

    // Check connection state
    const state = ablyClient.connection.state;
    if (state === "closed" || state === "closing" || state === "failed") {
      return;
    }

    try {
      // Must match the namespacing ablyServer.publishMessage() applies
      // server-side, or this never receives what the server publishes.
      const channel = ablyClient.channels.get(namespaced(`conversation:${conversationId}`)) as unknown as AblyRealtimeChannel;

      const handleNewMessage = (message: AblyMessage) => {
        const eventData = message.data as NewMessageEvent;

        // Don't process our own messages (already handled by optimistic update)
        if (eventData.senderId === user.id) return;

        // Instantly inject message into cache (no refetch needed!)
        queryClient.setQueryData<ThreadResponse>(
          ["messages", "thread", conversationId],
          (oldData) => {
            if (!oldData) return oldData;

            // Check if message already exists (avoid duplicates)
            const exists = oldData.messages.some(m => m.id === eventData.id);
            if (exists) return oldData;

            // Create new message from event data
            const newMessage: MessageResponse = {
              id: eventData.id,
              conversationId: eventData.conversationId,
              senderId: eventData.senderId,
              content: eventData.content,
              createdAt: eventData.createdAt,
              isRead: true, // Already read since user is viewing
              isOwn: false,
              readByOther: false,
              sender: {
                id: eventData.senderId,
                name: eventData.senderName || t("unknown"),
                image: eventData.senderImage || null,
              },
            };

            return {
              ...oldData,
              messages: [...oldData.messages, newMessage],
            };
          }
        );

        // Lightweight markAsRead call (fire-and-forget, no refetch)
        messagesApi.markAsRead(conversationId).then(() => {
          // Optimistically decrement unread count (faster than refetch)
          queryClient.setQueryData<number>(
            ["messages", "unread-count"],
            (old) => Math.max(0, (old ?? 1) - 1)
          );
        }).catch(() => {
          // Ignore errors - UI already updated
        });
      };

      channel.subscribe("message:new", handleNewMessage);
      subscriptionRef.current = { channel, handler: handleNewMessage };
    } catch (error) {
      console.error("[useMessageDetail] Failed to subscribe:", error);
    }

    return () => {
      if (subscriptionRef.current) {
        try {
          // Check if subscriptionRef has a single handler or multiple handlers
          const current = subscriptionRef.current;
          if ('handler' in current && current.handler && current.channel) {
            current.channel.unsubscribe("message:new", current.handler);
          } else if ('handlers' in current && current.handlers && current.channel) {
            // If we used handlers array in the future
            const targetChannel = current.channel;
            current.handlers.forEach((h) => targetChannel.unsubscribe(h.event, h.handler));
          }
        } catch {
          // Ignore - channel may be detached
        }
        subscriptionRef.current = null;
      }
    };
  }, [ablyClient, conversationId, queryClient, user?.id, t]);

  // Fetch thread data from API (real-time updates via Ably)
  const {
    data: threadData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["messages", "thread", conversationId],
    queryFn: () => messagesApi.getThread(conversationId),
    enabled: !!conversationId,
    refetchOnWindowFocus: false,
    structuralSharing: true,
  });

  // Transform API response to UI format
  const conversation: Conversation = useMemo(() => {
    if (!threadData) {
      return {
        id: conversationId,
        recipient: { name: t("loading") },
        listing: "",
        messages: [],
      };
    }

    // Use otherParticipant from API response (already filtered by backend)
    const other = threadData.otherParticipant;

    return {
      id: threadData.conversation.id,
      recipient: {
        name: other?.name || t("unknown"),
        avatar: other?.image || undefined,
        rating: other?.rating,
        reviewsCount: other?.reviewsCount,
      },
      listing: threadData.conversation.listing?.title || "",
      listingImage: threadData.conversation.listing?.images?.[0]?.url,
      messages: [],
    };
  }, [threadData, conversationId, t]);

  // Transform messages to UI format
  const messages: ChatMessage[] = useMemo(() => {
    if (!threadData) return [];

    return threadData.messages.map((msg) => ({
      id: msg.id,
      text: msg.content,
      timestamp: new Date(msg.createdAt).toLocaleTimeString(locale, {
        hour: "2-digit",
        minute: "2-digit",
      }),
      sentByMe: msg.isOwn,
      readByOther: msg.readByOther,
    }));
  }, [threadData, locale]);

  // Send message mutation with OPTIMISTIC UPDATE
  const sendMutation = useMutation({
    mutationFn: (content: string) =>
      messagesApi.sendMessage({
        conversationId,
        content,
      }),
    // Optimistic update: add message to UI immediately
    onMutate: async (content: string) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: ["messages", "thread", conversationId],
      });

      // Snapshot previous value
      const previousData = queryClient.getQueryData<ThreadResponse>([
        "messages",
        "thread",
        conversationId,
      ]);

      // Optimistically add the new message
      if (previousData) {
        const optimisticMessage: MessageResponse = {
          id: `temp-${Date.now()}`, // Temporary ID
          conversationId,
          senderId: "me",
          content,
          createdAt: new Date().toISOString(),
          isRead: false,
          isOwn: true,
          readByOther: false,
          sender: {
            id: "me",
            name: t("you"),
            image: null,
          },
        };

        queryClient.setQueryData<ThreadResponse>(
          ["messages", "thread", conversationId],
          {
            ...previousData,
            messages: [...previousData.messages, optimisticMessage],
          }
        );
      }

      // Return context with snapshot
      return { previousData };
    },
    // Rollback on error
    onError: (err, content, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(
          ["messages", "thread", conversationId],
          context.previousData
        );
      }
    },
    // Refetch after success or error
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["messages", "thread", conversationId],
      });
      queryClient.invalidateQueries({
        queryKey: ["messages", "conversations"],
      });
    },
  });

  // Handle sending a new message
  const sendMessage = useCallback(() => {
    if (!inputValue.trim()) return;
    sendMutation.mutate(inputValue);
    setInputValue("");
  }, [inputValue, sendMutation]);

  // Handle input value change
  const handleInputChange = useCallback((value: string) => {
    setInputValue(value);
  }, []);

  // Delete message mutation
  const deleteMutation = useMutation({
    mutationFn: (messageId: string) => messagesApi.deleteMessage(messageId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["messages", "thread", conversationId],
      });
    },
  });

  const deleteMessage = useCallback(
    (messageId: string) => {
      deleteMutation.mutate(messageId);
    },
    [deleteMutation]
  );

  return {
    conversation,
    messages,
    inputValue,
    setInputValue: handleInputChange,
    sendMessage,
    deleteMessage,
    isLoading,
    isSending: sendMutation.isPending,
    error,
  };
}
