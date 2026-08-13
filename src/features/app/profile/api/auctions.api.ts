export interface ApiAuction {
    id: string;
    title: string;
    images?: { url: string }[];
    currentPrice?: number;
    startPrice?: number;
    bidCount?: number;
    status: "active" | "ended" | "sold" | "cancelled";
    endsAt?: string;
    views?: number;
}

export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
    };
}

export async function fetchMyAuctions(): Promise<ApiAuction[]> {
    const res = await fetch("/api/listings");
    const data: ApiResponse<ApiAuction[]> = await res.json();

    if (!data.success) {
        throw new Error(data.error?.message || "Failed to fetch auctions");
    }

    return data.data || [];
}

export async function endAuction(id: string): Promise<void> {
    const res = await fetch(`/api/listings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ended" }),
    });

    const data: ApiResponse<void> = await res.json();

    if (!data.success) {
        throw new Error(data.error?.message || "Failed to end auction");
    }
}

export async function deleteAuction(id: string): Promise<void> {
    const res = await fetch(`/api/listings/${id}`, {
        method: "DELETE",
    });

    const data: ApiResponse<void> = await res.json();

    if (!data.success) {
        throw new Error(data.error?.message || "Failed to delete auction");
    }
}

export async function repostAuction(id: string, duration: string): Promise<void> {
    const res = await fetch(`/api/listings/${id}/repost`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auctionDuration: duration }),
    });

    const data: ApiResponse<void> = await res.json();

    if (!data.success) {
        throw new Error(data.error?.message || "Failed to repost auction");
    }
}
