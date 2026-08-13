export interface ProcessSlipResponse {
    dimensions?: { length: number; width: number; height: number };
    weight?: string;
    price?: number;
    description?: string;
    confidence?: number;
}

export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
    };
}

export async function processSlip(imageBase64: string): Promise<ProcessSlipResponse> {
    const res = await fetch("/api/ai/process-slip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageBase64 }),
    });

    const json: ApiResponse<ProcessSlipResponse> = await res.json();

    if (!json.success || !json.data) {
        throw new Error(json.error?.message || "Failed to process slip");
    }

    return json.data;
}

