/**
 * Admin client API for carrier application review.
 *
 * Mirrors the REST layer under /api/admin/carrier-applications and
 * /api/admin/carriers. Payload shapes follow the carriers DAL
 * (listByStatus returns the carrier row with documents, vehicles and user).
 */

export const CARRIER_APPLICATION_STATUSES = [
    "draft",
    "submitted",
    "under_review",
    "approved",
    "rejected",
    "suspended",
] as const;

export type CarrierApplicationStatus =
    (typeof CARRIER_APPLICATION_STATUSES)[number];

export type CarrierDocumentStatus = "pending" | "accepted" | "rejected";

export interface CarrierApplicationDocument {
    id: string;
    carrierId: string;
    kind:
        | "cni_recto"
        | "cni_verso"
        | "driving_licence"
        | "kbis"
        | "insurance_certificate"
        | "transport_licence"
        | "rib";
    mimeType: string;
    sizeBytes: number;
    expiresAt: string | null;
    status: CarrierDocumentStatus;
    rejectionReason: string | null;
    uploadedAt: string;
}

export interface CarrierApplicationVehicle {
    id: string;
    type: string;
    make: string | null;
    model: string | null;
    year: number | null;
    plateNumber: string;
    maxWeightKg: number;
    isActive: boolean;
}

export interface CarrierApplication {
    id: string;
    userId: string;
    user: {
        id: string;
        name: string;
        email: string;
        image: string | null;
    };
    companyName: string;
    siret: string;
    vatNumber: string | null;
    legalForm: string | null;
    contactPhone: string;
    addressLine: string;
    city: string;
    postalCode: string;
    status: CarrierApplicationStatus;
    ibanLast4: string | null;
    bicLast4: string | null;
    rejectionReason: string | null;
    suspensionReason: string | null;
    averageRating: number;
    totalRatings: number;
    completedJobs: number;
    bio: string | null;
    createdAt: string;
    updatedAt: string;
    documents: CarrierApplicationDocument[];
    vehicles: CarrierApplicationVehicle[];
}

export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
    };
}

export async function fetchCarrierApplications(
    status: CarrierApplicationStatus,
): Promise<CarrierApplication[]> {
    const res = await fetch(
        `/api/admin/carrier-applications?status=${status}`,
    );
    const data: ApiResponse<CarrierApplication[]> = await res.json();

    if (!data.success) {
        throw new Error(data.error?.message || "Failed to fetch applications");
    }

    return data.data || [];
}

export async function approveCarrierApplication(id: string): Promise<void> {
    const res = await fetch(`/api/admin/carrier-applications/${id}/approve`, {
        method: "POST",
    });

    const data: ApiResponse<CarrierApplication> = await res.json();

    if (!data.success) {
        throw new Error(data.error?.message || "Failed to approve application");
    }
}

export async function rejectCarrierApplication(
    id: string,
    reason: string,
): Promise<void> {
    const res = await fetch(`/api/admin/carrier-applications/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
    });

    const data: ApiResponse<CarrierApplication> = await res.json();

    if (!data.success) {
        throw new Error(data.error?.message || "Failed to reject application");
    }
}

export async function suspendCarrier(
    id: string,
    reason: string,
): Promise<void> {
    const res = await fetch(`/api/admin/carriers/${id}/suspend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
    });

    const data: ApiResponse<CarrierApplication> = await res.json();

    if (!data.success) {
        throw new Error(data.error?.message || "Failed to suspend carrier");
    }
}

/**
 * KYC documents are private: this exchanges a document id for a five-minute
 * presigned URL (admin or owner only, enforced server-side).
 */
export async function fetchDocumentViewUrl(documentId: string): Promise<string> {
    const res = await fetch(`/api/carrier/documents/${documentId}`);
    const data: ApiResponse<{ url: string; expiresInSeconds: number }> =
        await res.json();

    if (!data.success || !data.data) {
        throw new Error(data.error?.message || "Failed to load document");
    }

    return data.data.url;
}
