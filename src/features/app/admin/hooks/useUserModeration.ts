import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UpdatedUserData } from "@/server/dto/admin.dto";

// ========================================
// Types
// ========================================

interface UpdateStatusApiResponse {
  success: boolean;
  data?: UpdatedUserData;
  message?: string;
  error?: {
    code: string;
    message: string;
  };
}

interface UpdateUserStatusParams {
  userId: string;
  banned: boolean;
}

// ========================================
// Mutation Function
// ========================================

async function updateUserStatus(params: UpdateUserStatusParams): Promise<UpdatedUserData> {
  const response = await fetch(`/api/admin/users/${params.userId}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ banned: params.banned }),
  });

  const json: UpdateStatusApiResponse = await response.json();

  if (!response.ok || !json.success) {
    throw new Error(json.error?.message || "Failed to update user status");
  }

  return json.data!;
}

// ========================================
// Hook
// ========================================

/**
 * Hook to update user banned status (suspend/activate)
 */
export function useUpdateUserStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateUserStatus,
    onSuccess: () => {
      // Invalidate user-related queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "activity"] });
    },
  });
}

/**
 * Hook to suspend a user (convenience wrapper)
 */
export function useSuspendUser() {
  const mutation = useUpdateUserStatus();

  return {
    ...mutation,
    suspendUser: (userId: string) => mutation.mutate({ userId, banned: true }),
  };
}

/**
 * Hook to activate a user (convenience wrapper)
 */
export function useActivateUser() {
  const mutation = useUpdateUserStatus();

  return {
    ...mutation,
    activateUser: (userId: string) => mutation.mutate({ userId, banned: false }),
  };
}
