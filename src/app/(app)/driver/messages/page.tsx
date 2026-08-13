"use client";

import { Messages } from "@/features/app/messages/ui";
import { useMessages } from "@/features/app/messages/hooks";

/**
 * Driver Messages page - Orchestration layer
 * Uses shared useMessages hook for real-time API data
 */
export default function DriverMessagesPage() {
  const {
    messages,
    searchQuery,
    setSearchQuery,
    deleteConversation,
    isLoading,
  } = useMessages();

  return (
    <Messages
      messages={messages}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      onDeleteConversation={deleteConversation}
      basePath="/driver/messages"
      isLoading={isLoading}
    />
  );
}
