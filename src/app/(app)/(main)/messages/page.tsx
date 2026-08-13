"use client";

import { Messages } from "@/features/app/messages/ui";
import { useMessages } from "@/features/app/messages/hooks";

/**
 * Messages page - Orchestration layer
 * Follows SOLID principle - uses hooks for business logic, passes data to UI components
 */
export default function MessagesPage() {
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
      isLoading={isLoading}
      onSearchChange={setSearchQuery}
      onDeleteConversation={deleteConversation}
    />
  );
}

