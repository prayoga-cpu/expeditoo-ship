import { api } from "@/lib/fetcher";

export interface PlatformSettings {
  feeBasisPoints: number;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface UpdatePlatformSettingsInput {
  feeBasisPoints: number;
}

export const platformSettingsApi = {
  get: () => api.get<PlatformSettings>("/api/admin/settings"),
  update: (input: UpdatePlatformSettingsInput) =>
    api.patch<PlatformSettings>("/api/admin/settings", input),
};
