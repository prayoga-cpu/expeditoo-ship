"use client";

import { use } from "react";
import { MessageDetail } from "@/features/app/messages/ui";
import { useMessageDetail } from "@/features/app/messages/hooks";

/**
 * Message Detail page - Orchestration layer
 * Follows SOLID principle - uses hooks for business logic, passes data to UI components
 */
export default function MessageDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Unwrap params Promise (Next.js 15+ requirement)
  const { id } = use(params);

  const {
    conversation,
    messages,
    inputValue,
    setInputValue,
    sendMessage,
  } = useMessageDetail(id);

  return (
    <MessageDetail
      conversation={conversation}
      messages={messages}
      inputValue={inputValue}
      onInputChange={setInputValue}
      onSendMessage={sendMessage}
    />
  );
}


