import { api } from "@/lib/fetcher";

export interface PlatformSettings {
  feeBasisPoints: number;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface UpdatePlatformSettingsInput {
  feeBasisPoints: number;
}

export const COMPANY_FIELDS = [
  "legalName",
  "legalForm",
  "capital",
  "address",
  "siret",
  "rcs",
  "vatNumber",
  "vatRate",
  "billingEmail",
  "publicationDirector",
  "host",
] as const;

export type CompanyField = (typeof COMPANY_FIELDS)[number];

export interface CompanyIdentity {
  values: Record<CompanyField, string | null>;
  documentType: "invoice" | "receipt";
  missing: CompanyField[];
  updatedAt: string | null;
}

export type UpdateCompanyIdentityInput = Partial<Record<CompanyField, string>>;

export type StripeCheckKey =
  | "liveKeys"
  | "mockOff"
  | "chargesEnabled"
  | "webhookEndpoint"
  | "webhookReceived"
  | "firstRealPayment";

export interface StripeStatus {
  secretKeyMode: "live" | "test" | "missing" | "unknown";
  publishableKeyMode: "live" | "test" | "missing" | "unknown";
  mockPayments: boolean;
  account:
    | {
        reachable: true;
        id: string;
        name: string | null;
        chargesEnabled: boolean;
        payoutsEnabled: boolean;
        detailsSubmitted: boolean;
      }
    | { reachable: false; error: string };
  webhooks:
    | {
        reachable: true;
        endpoints: {
          url: string;
          status: string;
          kind: "thisApp" | "thisPathOtherHost" | "other";
          coversHandledEvents: boolean;
        }[];
      }
    | { reachable: false; error: string };
  lastEvent: { at: string; type: string; livemode: boolean } | null;
  payments: {
    realCount: number;
    firstRealAt: string | null;
    lastRealAt: string | null;
    mockCount: number;
  };
  checks: { key: StripeCheckKey; state: "ok" | "todo" | "fail" }[];
}

export const platformSettingsApi = {
  get: () => api.get<PlatformSettings>("/api/admin/settings"),
  update: (input: UpdatePlatformSettingsInput) =>
    api.patch<PlatformSettings>("/api/admin/settings", input),
  getCompany: () => api.get<CompanyIdentity>("/api/admin/company"),
  updateCompany: (input: UpdateCompanyIdentityInput) =>
    api.put<CompanyIdentity>("/api/admin/company", input),
  getStripeStatus: () => api.get<StripeStatus>("/api/admin/stripe-status"),
};
