"use client";

import { LoadErrorState } from "@/components/ui/load-error-state";
import { useRef, useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChatBubble } from "./ChatBubble";
import { Send, ArrowLeft, ArrowDown, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { ChatMessage, Conversation } from "../types";
import { ThreadOfferAction, ThreadOfferNotice } from "./ThreadOfferAction";
import { ThreadOfferBubble } from "./ThreadOfferBubble";
import { ListingReference } from "@/features/app/listing/ui/ListingReference";
import { useTranslations } from "next-intl";
import { jobLine } from "../lib/job-summary";
import { initialsOf } from "../lib/initials";

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
  /**
   * The thread never loaded. Without this the header read « Chargement… »
   * forever over an input box (no_dead_ends_spec.md §4).
   */
  loadFailed?: boolean;
  onRetry?: () => void;
}

export function MessageDetail({
  conversation,
  messages,
  inputValue,
  onInputChange,
  onSendMessage,
  onDeleteMessage,
  backLink = "/messages",
  loadFailed = false,
  onRetry,
}: MessageDetailProps) {
  const t = useTranslations("messages.detail");
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [hasNewMessage, setHasNewMessage] = useState(false);
  const prevMessagesLengthRef = useRef(messages.length);
  const initialScrollDoneRef = useRef(false);
  // The offer dialog, held here so a refused card can open the composer's own.
  const [offering, setOffering] = useState(false);
  const offerContext = conversation.offerContext;
  const ownOffers = messages.filter((m) => m.sentByMe && m.offer);
  const latestOwnOfferId = ownOffers[ownOffers.length - 1]?.offer?.id;
  // The viewer's live bid is one the requester refused here: its card carries
  // the way out, and the composer's notice must agree with it.
  const refusedLiveBid = ownOffers.some(
    (m) => m.offer?.status === "declined" && m.offer.offer?.status === "pending"
  );

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

  if (loadFailed && onRetry) {
    return (
      <LoadErrorState
        variant="page"
        onRetry={onRetry}
        back={{ href: backLink, label: t("backToInbox") }}
      />
    );
  }

  return (
    <div className="h-full min-h-0 flex flex-col bg-background   mx-auto w-full relative">
      {/* One sticky stack: who, then which job. The job row used to sit
          outside it and scrolled away with the messages, because the shell's
          <main> is what scrolls here, not the list below. */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="px-4 py-3 md:px-6 md:py-4 flex items-center gap-3">
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
            <AvatarFallback className="bg-linear-to-b from-blue-400 to-blue-600 dark:from-blue-600 dark:to-blue-950 text-white text-sm font-semibold">
              {conversation.recipient.initials ??
                initialsOf({ name: conversation.recipient.name })}
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

        {conversation.listing && <JobRow conversation={conversation} />}
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 space-y-2 relative"
      >
        {messages.map((message) =>
          message.offer ? (
            <ThreadOfferBubble
              key={message.id}
              conversationId={conversation.id}
              offer={message.offer}
              isOwn={message.sentByMe}
              timestamp={message.timestamp}
              avatar={message.senderAvatar ?? conversation.recipient.avatar}
              name={message.senderName ?? conversation.recipient.name}
              initials={
                message.senderName
                  ? message.senderInitials
                  : conversation.recipient.initials
              }
              readByOther={message.readByOther}
              viewerCanAward={offerContext?.viewerCanAward ?? false}
              canCounter={offerContext?.canCounter ?? false}
              onRepropose={() => setOffering(true)}
              canRepropose={
                Boolean(offerContext?.canOffer) &&
                message.offer.id === latestOwnOfferId
              }
              budgetCents={offerContext?.job?.budgetCents ?? null}
            />
          ) : (
            <ChatBubble
              key={message.id}
              message={message.text}
              isOwn={message.sentByMe}
              timestamp={message.timestamp}
              avatar={message.senderAvatar ?? conversation.recipient.avatar}
              name={message.senderName ?? conversation.recipient.name}
              initials={
                message.senderName
                  ? message.senderInitials
                  : conversation.recipient.initials
              }
              readByOther={message.readByOther}
              onDelete={
                message.sentByMe && onDeleteMessage
                  ? () => onDeleteMessage(message.id)
                  : undefined
              }
            />
          )
        )}
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
      <div className="border-t border-border bg-background sticky bottom-0 z-10">
        <ThreadOfferNotice context={offerContext} refused={refusedLiveBid} />
        <div className="flex gap-2 p-4 md:p-6">
          <ThreadOfferAction
            conversationId={conversation.id}
            context={offerContext}
            open={offering}
            onOpenChange={setOffering}
          />
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

/**
 * Which job the thread is about, pinned under the name: title and reference on
 * one line, « Paris → Lyon · 20 nov. – 22 nov. » on the next, and the whole row
 * a link to the job. Two lines and a small thumbnail, so on a phone it costs
 * the conversation about as much as one bubble.
 */
function JobRow({ conversation }: { conversation: Conversation }) {
  const t = useTranslations("messages.detail");
  const line = jobLine(conversation.listingRoute, conversation.listingDates);

  const body = (
    <>
      {conversation.listingImage ? (
        <div className="h-9 w-9 shrink-0 overflow-hidden rounded-md border border-border bg-background">
          <img
            src={conversation.listingImage}
            alt=""
            className="h-full w-full object-cover"
          />
        </div>
      ) : (
        <div
          aria-hidden
          className="h-9 w-9 shrink-0 flex items-center justify-center rounded-md border border-border bg-background text-muted-foreground"
        >
          📦
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {conversation.listing}
          </p>
          {conversation.listingReference !== undefined && (
            <ListingReference
              reference={conversation.listingReference}
              className="shrink-0"
            />
          )}
        </div>
        {line && (
          <p className="text-xs text-muted-foreground truncate">{line}</p>
        )}
      </div>
    </>
  );
  const className =
    "flex items-center gap-3 px-4 md:px-6 py-2 bg-muted/50 border-t border-border";

  // No id, no link: a thread cached before the payload carried it.
  if (!conversation.listingId) return <div className={className}>{body}</div>;

  return (
    <Link
      href={`/listing/${conversation.listingId}`}
      title={t("openListing")}
      className={`${className} transition-colors hover:bg-muted`}
    >
      {body}
      <ChevronRight
        aria-hidden
        className="h-4 w-4 shrink-0 text-muted-foreground"
      />
    </Link>
  );
}
