import { useQuery } from "@tanstack/react-query";

// ========================================
// Types
// ========================================

export interface TransporterProfile {
    id: string;
    userId: string;
    vehicleType: string;
    vehiclePlate: string;
    licenseNumber: string;
    capacityKg: number;
    capacityM3: number | null;
    serviceZones: string[];
    isAvailable: boolean;
    rating: number;
    totalDeliveries: number;
    completedDeliveries: number;
    bio: string | null;
    createdAt: string;
    updatedAt: string;
    user: {
        id: string;
        name: string | null;
        image: string | null;
    };
}

export interface TransportersResponse {
    items: TransporterProfile[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export interface TransporterQueryParams {
    page?: number;
    limit?: number;
    minRating?: number;
    vehicleType?: string;
    zone?: string;
}

// Standard API response wrapper
interface ApiResponse<T> {
    success: boolean;
    data: T;
    error?: {
        code: string;
        message: string;
    };
}

// ========================================
// API Functions
// ========================================

async function fetchTransporters(
    params: TransporterQueryParams = {}
): Promise<TransportersResponse> {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set("page", params.page.toString());
    if (params.limit) searchParams.set("limit", params.limit.toString());
    if (params.minRating) searchParams.set("minRating", params.minRating.toString());
    if (params.vehicleType) searchParams.set("vehicleType", params.vehicleType);
    if (params.zone) searchParams.set("zone", params.zone);

    const response = await fetch(`/api/transporters?${searchParams.toString()}`);
    const json: ApiResponse<TransportersResponse> = await response.json();

    if (!response.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to fetch transporters");
    }

    return json.data;
}

// ========================================
// Hooks
// ========================================

/**
 * Hook to fetch available transporters with filters
 */
export function useTransporters(params: TransporterQueryParams = {}) {
    return useQuery({
        queryKey: ["transporters", params],
        queryFn: () => fetchTransporters(params),
        staleTime: 30 * 1000, // 30 seconds - availability can change
    });
}

/**
 * Hook to search transporters by zone
 */
export function useTransportersByZone(zone: string) {
    return useTransporters({ zone, limit: 20 });
}

/**
 * Hook to get top-rated transporters
 */
export function useTopTransporters(limit = 5) {
    return useTransporters({ minRating: 4.5, limit });
}
