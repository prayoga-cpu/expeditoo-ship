export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
    };
}

export interface ChatInitResponse {
    conversationId: string;
}

export interface ChatInitParams {
    recipientId: string;
    listingId?: string;
}

export async function initChat(params: ChatInitParams): Promise<ChatInitResponse> {
    const res = await fetch("/api/messages/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
    });

    const data: ApiResponse<ChatInitResponse> = await res.json();

    if (!data.success || !data.data) {
        throw new Error(data.error?.message || "Failed to start conversation");
    }

    return data.data;
}
