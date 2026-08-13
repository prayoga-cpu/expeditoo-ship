export interface UploadResponse {
    url: string;
}

export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
    };
}

export async function uploadImage(file: File): Promise<string> {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
    });

    const data: ApiResponse<UploadResponse> = await res.json();

    if (!data.success || !data.data) {
        throw new Error(data.error?.message || "Failed to upload image");
    }

    return data.data.url;
}
