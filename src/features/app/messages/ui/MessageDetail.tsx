"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChatBubble } from "./ChatBubble";
import { Send, ArrowLeft, ArrowDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { ChatMessage, Conversation } from "../types";
import { useTranslations } from "next-intl";

/**
 * Pure UI component for displaying message detail/chat
 * Follows Single Responsibility Principle - only handles presentation
 * Business logic handled by useMessageDetail hook in page
 *
 * Features:
 * - Auto-scroll to bottom on initial load
 * - New message indicator when scrolled up
 * - Quick scroll-to-bottom button
 *
 * @param conversation - Conversation data
 * @param messages - Array of chat messages
 * @param inputValue - Current input value
 * @param onInputChange - Callback when input changes
 * @param onSendMessage - Callback when send button is clicked
 */
interface MessageDetailProps {
  conversation: Conversation;
  messages: ChatMessage[];
  inputValue: string;
  onInputChange: (value: string) => void;
  onSendMessage: () => void;
  onDeleteMessage?: (messageId: string) => void;
  backLink?: string;
}

export function MessageDetail({
  conversation,
  messages,
  inputValue,
  onInputChange,
  onSendMessage,
  onDeleteMessage,
  backLink = "/messages",
}: MessageDetailProps) {
  const t = useTranslations("messages.detail");
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [hasNewMessage, setHasNewMessage] = useState(false);
  const prevMessagesLengthRef = useRef(messages.length);
  const initialScrollDoneRef = useRef(false);

  // Scroll to bottom function
  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
    setHasNewMessage(false);
  }, []);

  // Check if user is at bottom of chat
  const checkIfAtBottom = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return true;
    const threshold = 100; // pixels from bottom
    return (
      container.scrollHeight - container.scrollTop - container.clientHeight <
      threshold
    );
  }, []);

  // Handle scroll event
  const handleScroll = useCallback(() => {
    const atBottom = checkIfAtBottom();
    setIsAtBottom(atBottom);
    if (atBottom) {
      setHasNewMessage(false);
    }
  }, [checkIfAtBottom]);

  // Auto-scroll to bottom on initial load
  useEffect(() => {
    if (messages.length > 0 && !initialScrollDoneRef.current) {
      scrollToBottom("instant");
      initialScrollDoneRef.current = true;
    }
  }, [messages.length, scrollToBottom]);

  // Handle new messages
  useEffect(() => {
    const prevLength = prevMessagesLengthRef.current;
    const currentLength = messages.length;

    if (currentLength > prevLength && initialScrollDoneRef.current) {
      // New message arrived
      const latestMessage = messages[currentLength - 1];

      if (latestMessage?.sentByMe || isAtBottom) {
        // Auto-scroll if user sent message or is at bottom
        scrollToBottom("smooth");
      } else {
        // Show new message indicator
        setHasNewMessage(true);
      }
    }

    prevMessagesLengthRef.current = currentLength;
  }, [messages, isAtBottom, scrollToBottom]);

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSendMessage();
    }
  };

  return (
    <div className="h-full min-h-0 flex flex-col bg-background   mx-auto w-full relative">
      {/* Header */}
      <div className="p-4 md:p-6 border-b border-border sticky top-0 bg-background/95 backdrop-blur flex items-center gap-3 z-10">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full -ml-2"
          onClick={() => router.push(backLink)}
        >
          <ArrowLeft className="w-6 h-6" />
        </Button>
        <Avatar className="w-10 h-10">
          <AvatarImage
            src={conversation.recipient.avatar}
            alt={conversation.recipient.name}
          />
          <AvatarFallback className="bg-linear-to-b from-blue-400 to-blue-600 dark:from-blue-600 dark:to-blue-950 text-white">
            {conversation.recipient.name.charAt(0)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-foreground truncate">
            {conversation.recipient.name}
          </h1>
          <p className="text-xs text-muted-foreground truncate">
            {conversation.recipient.rating !== undefined ? (
              <>
                ⭐ {conversation.recipient.rating.toFixed(1)}/5 (
                {conversation.recipient.reviewsCount || 0})
              </>
            ) : (
              t("noRatings")
            )}
          </p>
        </div>
      </div>

      {/* Item Context Card - Only show if there's a listing */}
      {conversation.listing && (
        <div className="px-4 md:px-6 py-3 bg-muted/50 border-b border-border flex items-center gap-3">
          {conversation.listingImage ? (
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md border border-border bg-background">
              <img
                src={conversation.listingImage}
                alt={conversation.listing}
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div className="h-10 w-10 shrink-0 flex items-center justify-center rounded-md border border-border bg-background text-muted-foreground">
              📦
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">{t("aboutListing")}</p>
            <p className="font-medium text-foreground truncate">
              {conversation.listing}
            </p>
          </div>
        </div>
      )}

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 space-y-2 relative"
      >
        {messages.map((message) => (
          <ChatBubble
            key={message.id}
            message={message.text}
            isOwn={message.sentByMe}
            timestamp={message.timestamp}
            avatar={conversation.recipient.avatar}
            readByOther={message.readByOther}
            onDelete={
              message.sentByMe && onDeleteMessage
                ? () => onDeleteMessage(message.id)
                : undefined
            }
          />
        ))}
        {/* Invisible element at bottom for scroll target */}
        <div ref={messagesEndRef} />
      </div>

      {/* New Message Indicator & Scroll to Bottom Button */}
      {(!isAtBottom || hasNewMessage) && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-20">
          <Button
            onClick={() => scrollToBottom("smooth")}
            size={hasNewMessage ? "sm" : "icon"}
            className="rounded-full shadow-lg gap-2 animate-in fade-in slide-in-from-bottom-2"
          >
            {hasNewMessage && (
              <span className="flex h-2 w-2 rounded-full bg-white animate-pulse" />
            )}
            {hasNewMessage ? t("newMessage") : ""}
            <ArrowDown className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Message Composer */}
      <div className="border-t border-border p-4 md:p-6 bg-background sticky bottom-0 z-10">
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder={t("typeMessage")}
            className="rounded-full"
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyPress={handleKeyPress}
          />
          <Button
            onClick={onSendMessage}
            disabled={!inputValue.trim()}
            className="rounded-full shrink-0"
            size="icon"
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
