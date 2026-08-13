import { useCallback } from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// Types matching the API
interface NotificationChannel {
  email: boolean;
  inApp: boolean;
}

interface UserPreferences {
  notifications: {
    messages: NotificationChannel;
    bids: NotificationChannel;
    orders: NotificationChannel;
    shipments: NotificationChannel;
    marketing: NotificationChannel;
  };
}

// Legacy type for Settings UI compatibility
export interface NotificationSettings {
  email: {
    auctionResults: boolean;
    marketing: boolean;
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
  input: Partial<UserPreferences>
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
 */
export function useSettings() {
  const { theme, setTheme } = useTheme();
  const queryClient = useQueryClient();

  // Fetch preferences from API
  const { data: preferencesData, isLoading } = useQuery({
    queryKey: ["preferences"],
    queryFn: fetchPreferences,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Mutation for updating preferences
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

  // Transform API preferences to Settings UI format
  const notifications: NotificationSettings = {
    email: {
      auctionResults: preferencesData?.preferences?.notifications?.bids?.email ?? true,
      marketing: preferencesData?.preferences?.notifications?.marketing?.email ?? false,
    },
  };

  const handleThemeChange = useCallback((newTheme: string) => {
    setTheme(newTheme);
  }, [setTheme]);

  const handleNotificationChange = useCallback(
    (key: "auctionResults" | "marketing", value: boolean) => {
      // Map Settings UI key to API structure
      const categoryMap: Record<string, keyof UserPreferences["notifications"]> = {
        auctionResults: "bids",
        marketing: "marketing",
      };

      const category = categoryMap[key];
      const currentPrefs = preferencesData?.preferences?.notifications;

      // Only update the specific category
      updatePreferencesMutation({
        notifications: {
          messages: currentPrefs?.messages ?? { email: true, inApp: true },
          bids: currentPrefs?.bids ?? { email: true, inApp: true },
          orders: currentPrefs?.orders ?? { email: true, inApp: true },
          shipments: currentPrefs?.shipments ?? { email: true, inApp: true },
          marketing: currentPrefs?.marketing ?? { email: false, inApp: false },
          [category]: {
            ...currentPrefs?.[category],
            email: value,
          },
        },
      });
    },
    [preferencesData?.preferences?.notifications, updatePreferencesMutation]
  );

  return {
    theme,
    notifications,
    isLoading,
    handleThemeChange,
    handleNotificationChange,
  };
}
