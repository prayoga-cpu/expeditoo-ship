"use client";

import { use } from "react";
import { MessageDetail } from "@/features/app/messages/ui";
import { useMessageDetail } from "@/features/app/messages/hooks";

/**
 * Driver Message Detail page - Orchestration layer
 * Returns to /driver/messages when back button is clicked
 */
interface PageProps {
  params: Promise<{ id: string }>;
}

export default function DriverMessageDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const { conversation, messages, inputValue, setInputValue, sendMessage } =
    useMessageDetail(id);

  return (
    <MessageDetail
      conversation={conversation}
      messages={messages}
      inputValue={inputValue}
      onInputChange={setInputValue}
      onSendMessage={sendMessage}
      backLink="/driver/messages"
    />
  );
}

