import { useQuery } from "@tanstack/react-query";

interface SupportChat {
    conversationId: string;
    type: string;
    user: {
        id: string;
        name: string;
        email: string;
        image: string | null;
    };
    lastMessage: {
        content: string;
        createdAt: Date;
        senderId: string;
    } | null;
    unreadCount: number;
    lastMessageAt: Date | null;
    createdAt: Date;
}

interface SupportChatsResponse {
    chats: SupportChat[];
    total: number;
}

export function useSupportChats(status: "all" | "unread" = "all") {
    const { data, isLoading, error, refetch } = useQuery<{ success: boolean; data: SupportChatsResponse }>({
        queryKey: ["admin", "support-chats", status],
        queryFn: async () => {
            const res = await fetch(`/api/admin/support-chats?status=${status}`);
            if (!res.ok) {
                throw new Error("Failed to fetch support chats");
            }
            return res.json();
        },
    });

    return {
        chats: data?.data?.chats || [],
        total: data?.data?.total || 0,
        isLoading,
        error,
        refetch
    };
}
