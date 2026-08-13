import { api } from "@/lib/fetcher";

export type CarrierStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "rejected"
  | "suspended";

export interface Vehicle {
  id: string;
  type: string;
  make: string | null;
  model: string | null;
  year: number | null;
  plateNumber: string;
  maxWeightKg: number;
  maxLengthCm: number | null;
  maxWidthCm: number | null;
  maxHeightCm: number | null;
  features: string[];
  isActive: boolean;
}

export interface CarrierDocument {
  id: string;
  kind: string;
  status: "pending" | "accepted" | "rejected";
  expiresAt: string | null;
  rejectionReason: string | null;
}

export interface CarrierApplication {
  id: string;
  companyName: string;
  siret: string;
  vatNumber: string | null;
  legalForm: string | null;
  contactPhone: string;
  addressLine: string;
  city: string;
  postalCode: string;
  status: CarrierStatus;
  ibanLast4: string | null;
  bicLast4: string | null;
  rejectionReason: string | null;
  suspensionReason: string | null;
  documents: CarrierDocument[];
  vehicles: Vehicle[];
}

export interface CarrierProfileInput {
  companyName: string;
  siret: string;
  vatNumber?: string;
  legalForm?: string;
  contactPhone: string;
  addressLine: string;
  city: string;
  postalCode: string;
  bio?: string;
}

export interface VehicleInput {
  type: string;
  make?: string;
  model?: string;
  year?: number;
  plateNumber: string;
  maxWeightKg: number;
  maxLengthCm?: number;
  maxWidthCm?: number;
  maxHeightCm?: number;
  features?: string[];
}

export const carrierApi = {
  getApplication: () =>
    api.get<CarrierApplication | null>("/api/carrier/application"),

  saveProfile: (input: CarrierProfileInput) =>
    api.post<CarrierApplication>("/api/carrier/application", input),

  submit: () => api.post<CarrierApplication>("/api/carrier/application/submit"),

  withdraw: () =>
    api.post<CarrierApplication>("/api/carrier/application/withdraw"),

  setBanking: (iban: string, bic: string) =>
    api.post<CarrierApplication>("/api/carrier/banking", { iban, bic }),

  /**
   * Sends the file itself rather than a URL: KYC documents must never transit
   * the public upload path (docs/specs/carrier_kyc_spec.md §4).
   */
  uploadDocument: (kind: string, file: File, expiresAt?: string) => {
    const form = new FormData();
    form.set("kind", kind);
    form.set("file", file);
    if (expiresAt) form.set("expiresAt", expiresAt);
    return api.post<CarrierDocument>("/api/carrier/documents", form);
  },

  /** Documents are only ever reachable through a short-lived signed URL. */
  viewDocument: (id: string) =>
    api.get<{ url: string; expiresInSeconds: number }>(
      `/api/carrier/documents/${id}`
    ),

  listVehicles: () => api.get<Vehicle[]>("/api/carrier/vehicles"),

  addVehicle: (input: VehicleInput) =>
    api.post<Vehicle>("/api/carrier/vehicles", input),

  updateVehicle: (id: string, input: Partial<VehicleInput> & { isActive?: boolean }) =>
    api.patch<Vehicle>(`/api/carrier/vehicles/${id}`, input),

  deleteVehicle: (id: string) =>
    api.delete<{ deleted: boolean }>(`/api/carrier/vehicles/${id}`),
};
