import { useCallback } from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { UserPreferences } from "@/db/schema/users";

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
  const { theme, setTheme } = useTheme();
  const queryClient = useQueryClient();

  const { data: preferencesData, isLoading, isError } = useQuery({
    queryKey: ["preferences"],
    queryFn: fetchPreferences,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const { mutate: updatePreferencesMutation } = useMutation({
    mutationFn: updatePreferences,
    onSuccess: (data) => {
      queryClient.setQueryData(["preferences"], data);
      toast.success("Settings updated");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update settings");
    },
  });

  const email = preferencesData?.preferences?.notifications?.email;
  const inApp = preferencesData?.preferences?.notifications?.inApp;

  const handleThemeChange = useCallback((newTheme: string) => {
    setTheme(newTheme);
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
    handleThemeChange,
    handleNotificationChange,
  };
}
