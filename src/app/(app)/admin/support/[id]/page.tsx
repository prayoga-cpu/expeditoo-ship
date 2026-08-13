"use client";

import { use } from "react";
import { MessageDetail } from "@/features/app/messages/ui";
import { useMessageDetail } from "@/features/app/messages/hooks";

/**
 * Admin Support Chat Page
 * Specialized view for admins to handle support tickets
 */
export default function AdminSupportChatPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = use(params);

    const {
        conversation,
        messages,
        inputValue,
        setInputValue,
        sendMessage,
    } = useMessageDetail(id);

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] md:h-[calc(100vh-5rem)]">
            <MessageDetail
                conversation={conversation}
                messages={messages}
                inputValue={inputValue}
                onInputChange={setInputValue}
                onSendMessage={sendMessage}
                backLink="/admin/support"
            />
        </div>
    );
}
