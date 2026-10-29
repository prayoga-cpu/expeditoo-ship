/**
 * Admin client API for carrier application review.
 *
 * Mirrors the REST layer under /api/admin/carrier-applications and
 * /api/admin/carriers. Payload shapes follow the carriers DAL
 * (listByStatus returns the carrier row with documents, vehicles and user).
 */

import type { VehicleType } from "@/lib/carrier-constants";

export const CARRIER_APPLICATION_STATUSES = [
    "draft",
    "submitted",
    "under_review",
    "approved",
    "rejected",
    "suspended",
    "deregistered",
] as const;

export type CarrierApplicationStatus =
    (typeof CARRIER_APPLICATION_STATUSES)[number];

/** The review queue defaults to every status; "all" is the unfiltered view. */
export const ALL_STATUSES = "all" as const;

export type CarrierApplicationFilter =
    | CarrierApplicationStatus
    | typeof ALL_STATUSES;

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
    /** « Absent » — client_feedback_2026_10_29_spec.md §REQ-02. */
    absentSince: string | null;
    absentUntil: string | null;
    absenceReason: string | null;
    deregisteredAt: string | null;
    deregistrationReason: string | null;
    averageRating: number;
    totalRatings: number;
    completedJobs: number;
    bio: string | null;
    createdAt: string;
    updatedAt: string;
    documents: CarrierApplicationDocument[];
    vehicles: CarrierApplicationVehicle[];
}

/** Mirrors `createDriverSchema` (src/server/dto/carrier.dto.ts). */
export interface CreateDriverInput {
    name: string;
    email: string;
    companyName: string;
    siret: string;
    vatNumber?: string;
    legalForm?: string;
    contactPhone: string;
    addressLine: string;
    city: string;
    postalCode: string;
    bio?: string;
    vehicle: {
        type: VehicleType;
        maxWeightKg: number;
        plateNumber: string;
    };
}

export interface CreateDriverResult {
    carrierId: string;
    userId: string;
    name: string;
    email: string;
    /** False when an existing account was converted rather than created. */
    accountCreated: boolean;
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
    status: CarrierApplicationFilter = ALL_STATUSES,
): Promise<CarrierApplication[]> {
    const query =
        status === ALL_STATUSES ? "" : `?status=${encodeURIComponent(status)}`;
    const res = await fetch(`/api/admin/carrier-applications${query}`);
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

/** What `PUT …/availability` takes (`carrierAvailabilitySchema`). */
export type CarrierAvailabilityRequest =
    | { absent: true; until: string | null; reason: string | null }
    | { absent: false };

async function postCarrierAction(
    path: string,
    method: "POST" | "PUT",
    body?: unknown,
): Promise<void> {
    const res = await fetch(path, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
    });
    const data: ApiResponse<CarrierApplication> = await res.json();
    if (!data.success) {
        throw new Error(data.error?.message || data.error?.code || "Request failed");
    }
}

/** « Marquer absent » / « Fin d'absence » (§REQ-02). */
export const setCarrierAvailability = (
    id: string,
    input: CarrierAvailabilityRequest,
) => postCarrierAction(`/api/admin/carriers/${id}/availability`, "PUT", input);

/** « Désinscrire » (§REQ-02). */
export const deregisterCarrier = (id: string, reason: string) =>
    postCarrierAction(`/api/admin/carriers/${id}/deregister`, "POST", { reason });

/** « Réactiver » a suspended driver (§REQ-02). */
export const reinstateCarrier = (id: string) =>
    postCarrierAction(`/api/admin/carriers/${id}/reinstate`, "POST");

export async function createDriver(
    data: CreateDriverInput,
): Promise<CreateDriverResult> {
    const res = await fetch("/api/admin/carriers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });

    const body: ApiResponse<CreateDriverResult> = await res.json();

    if (!body.success || !body.data) {
        throw new Error(body.error?.message || "Failed to create driver");
    }

    return body.data;
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
