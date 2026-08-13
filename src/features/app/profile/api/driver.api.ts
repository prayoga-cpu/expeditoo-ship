export interface DriverApplicationInput {
    vehicleType: string;
    vehiclePlate: string;
    licenseNumber: string;
    siret: string;
    companyName?: string;
    proposalRate?: string;
}

export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
    };
}

export async function submitDriverApplication(input: DriverApplicationInput): Promise<void> {
    const res = await fetch("/api/driver/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });

    const data: ApiResponse<void> = await res.json();

    if (!data.success) {
        throw new Error(data.error?.message || "Failed to submit application");
    }
}
