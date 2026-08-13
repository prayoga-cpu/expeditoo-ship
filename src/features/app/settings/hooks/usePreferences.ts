import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// ========================================
// Types
// ========================================

export interface NotificationSettings {
    email: boolean;
    inApp: boolean;
}

export interface UserPreferences {
    notifications: {
        messages: NotificationSettings;
        bids: NotificationSettings;
        orders: NotificationSettings;
        shipments: NotificationSettings;
        marketing: NotificationSettings;
    };
}

export type UpdatePreferencesInput = Partial<UserPreferences>;

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

// ========================================
// API Functions
// ========================================

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

// ========================================
// Hooks
// ========================================

/**
 * Hook to fetch user notification preferences
 */
export function usePreferences() {
    return useQuery({
        queryKey: ["preferences"],
        queryFn: fetchPreferences,
        staleTime: 5 * 60 * 1000, // 5 minutes - preferences don't change often
    });
}

/**
 * Hook to update user notification preferences
 */
export function useUpdatePreferences() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: updatePreferences,
        onSuccess: (data) => {
            queryClient.setQueryData(["preferences"], data);
            toast.success("Preferences updated successfully");
        },
        onError: (error: Error) => {
            toast.error(error.message || "Failed to update preferences");
        },
    });
}

/**
 * Convenience hook to toggle a specific notification setting
 */
export function useToggleNotification() {
    const { data } = usePreferences();
    const { mutate } = useUpdatePreferences();

    const toggle = (
        category: keyof UserPreferences["notifications"],
        channel: "email" | "inApp"
    ) => {
        if (!data?.preferences) return;

        const currentValue = data.preferences.notifications[category][channel];

        mutate({
            notifications: {
                ...data.preferences.notifications,
                [category]: {
                    ...data.preferences.notifications[category],
                    [channel]: !currentValue,
                },
            },
        });
    };

    return { toggle, preferences: data?.preferences };
}
