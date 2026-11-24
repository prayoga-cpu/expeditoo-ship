import { useCallback } from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { UserPreferences } from "@/db/schema/users";
import { appThemeOf, isAppTheme } from "@/lib/theme";

type NotificationChannel = keyof UserPreferences["notifications"];

interface UpdatePreferencesInput {
  notifications?: {
    email?: Partial<UserPreferences["notifications"]["email"]>;
    inApp?: Partial<UserPreferences["notifications"]["inApp"]>;
  };
}

// Standard API response wrapper
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: {
    code: string;
    message: string;
  };
}

// API functions
async function fetchPreferences(): Promise<{ preferences: UserPreferences }> {
  const response = await fetch("/api/user/preferences");
  const json: ApiResponse<{ preferences: UserPreferences }> = await response.json();

  if (!response.ok || !json.success) {
    throw new Error(json.error?.message || "Failed to fetch preferences");
  }

  return json.data;
}

async function updatePreferences(
  input: UpdatePreferencesInput
): Promise<{ preferences: UserPreferences }> {
  const response = await fetch("/api/user/preferences", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const json: ApiResponse<{ preferences: UserPreferences }> = await response.json();

  if (!response.ok || !json.success) {
    throw new Error(json.error?.message || "Failed to update preferences");
  }

  return json.data;
}

/**
 * Custom hook for settings management
 * Fetches and updates user preferences via API
 *
 * `notifications.email` and `notifications.inApp` are handed back exactly as
 * `UserPreferences` stores them — no relabelling layer. The previous version
 * mapped a UI key ("auctionResults") onto a made-up API category ("bids")
 * that existed in neither the DTO nor the database column, so toggling it
 * round-tripped through validation and updated nothing.
 */
export function useSettings() {
  const { theme: chosen, setTheme } = useTheme();
  // What the radios show: light unless Dark was chosen (no "System", 2.96.0 #29).
  const theme = appThemeOf(chosen);
  const queryClient = useQueryClient();
  const t = useTranslations("settings");

  const { data: preferencesData, isLoading, isError, refetch } = useQuery({
    queryKey: ["preferences"],
    queryFn: fetchPreferences,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const { mutate: updatePreferencesMutation } = useMutation({
    mutationFn: updatePreferences,
    onSuccess: (data) => {
      queryClient.setQueryData(["preferences"], data);
      toast.success(t("updated"));
    },
    onError: (error: Error) => {
      toast.error(error.message || t("updateFailed"));
    },
  });

  const email = preferencesData?.preferences?.notifications?.email;
  const inApp = preferencesData?.preferences?.notifications?.inApp;

  const handleThemeChange = useCallback((newTheme: string) => {
    if (isAppTheme(newTheme)) setTheme(newTheme);
  }, [setTheme]);

  const handleNotificationChange = useCallback(
    <C extends NotificationChannel>(
      channel: C,
      key: keyof UserPreferences["notifications"][C],
      value: boolean
    ) => {
      updatePreferencesMutation({
        notifications: { [channel]: { [key]: value } },
      } as UpdatePreferencesInput);
    },
    [updatePreferencesMutation]
  );

  return {
    theme,
    email,
    inApp,
    isLoading,
    isError,
    refetch,
    handleThemeChange,
    handleNotificationChange,
  };
}
