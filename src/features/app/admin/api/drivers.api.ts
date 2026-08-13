export interface DriverApplication {
    id: string;
    userId: string;
    user: {
        name: string;
        email: string;
        image: string | null;
    };
    status: "PENDING" | "APPROVED" | "REJECTED";
    vehicleType: string;
    vehiclePlate: string;
    licenseNumber: string;
    siret: string;
    companyName?: string | null;
    proposalRate?: string | null;
    createdAt: string | Date; // API returns string (ISO), but Date object if strictly typed? JSON is string.
    documents?: {
        license: string;
        idCard: string;
    } | null;
}

export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
    };
}

export async function fetchDriverApplications(): Promise<DriverApplication[]> {
    const res = await fetch("/api/admin/driver-applications");
    const data: ApiResponse<DriverApplication[]> = await res.json();

    if (!data.success) {
        throw new Error(data.error?.message || "Failed to fetch applications");
    }

    return data.data || [];
}

export async function approveDriverApplication(id: string): Promise<void> {
    const res = await fetch(`/api/admin/driver-applications/${id}/approve`, {
        method: "POST",
    });

    const data: ApiResponse<void> = await res.json();

    if (!data.success) {
        throw new Error(data.error?.message || "Failed to approve application");
    }
}

export async function rejectDriverApplication(id: string): Promise<void> {
    const res = await fetch(`/api/admin/driver-applications/${id}/reject`, {
        method: "POST",
    });

    const data: ApiResponse<void> = await res.json();

    if (!data.success) {
        throw new Error(data.error?.message || "Failed to reject application");
    }
}
