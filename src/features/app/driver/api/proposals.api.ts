export interface CreateProposalInput {
    shipmentId: string;
    price: number;
    message?: string;
    estimatedDelivery?: Date; // Changed to match backend DTO
}

export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
    };
}

export async function submitProposal(input: CreateProposalInput): Promise<void> {
    const res = await fetch(`/api/shipments/${input.shipmentId}/proposals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            price: input.price,
            message: input.message,
            estimatedDelivery: input.estimatedDelivery,
        }),
    });

    const data: ApiResponse<void> = await res.json();

    if (!data.success) {
        throw new Error(data.error?.message || "Failed to submit proposal");
    }
}
