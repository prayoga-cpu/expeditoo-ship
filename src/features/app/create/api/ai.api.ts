export interface AnalyzeImageResponse {
    title: string;
    description: string;
    category: string;
    condition: string;
    estimatedPrice: number;
}

export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
    };
}

export async function analyzeImage(imageUrl: string): Promise<AnalyzeImageResponse> {
    const res = await fetch("/api/ai/analyze-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl }),
    });

    const data: ApiResponse<AnalyzeImageResponse> = await res.json();

    if (!data.success || !data.data) {
        throw new Error(data.error?.message || "Failed to analyze image");
    }

    return data.data;
}
