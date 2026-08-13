export interface CreateListingInput {
    title: string;
    description: string;
    price: number;
    category: string;
    condition: string;
    images: string[];
}

export interface Listing {
    id: string;
    title: string;
    // Add other fields as needed
}

export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
    };
}

export async function createListing(input: CreateListingInput): Promise<Listing> {
    const res = await fetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });

    const data: ApiResponse<Listing> = await res.json();

    if (!data.success || !data.data) {
        throw new Error(data.error?.message || "Failed to create listing");
    }

    return data.data;
}
