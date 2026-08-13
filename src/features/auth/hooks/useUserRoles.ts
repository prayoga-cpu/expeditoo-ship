import { useQuery } from "@tanstack/react-query";
import type { UserRole } from "@/server/dto/user-roles.dto";

interface ApiResponse {
  success: boolean;
  data?: { roles: UserRole[] };
  error?: { code: string; message: string };
}

/**
 * Fetch user roles from API
 */
async function fetchUserRoles(): Promise<UserRole[]> {
  const response = await fetch("/api/user/roles");

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Unauthorized");
    }
    throw new Error("Failed to fetch user roles");
  }

  const result: ApiResponse = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.error?.message || "Failed to fetch user roles");
  }
  return result.data.roles;
}

/**
 * Hook to fetch and manage user roles
 * @returns User roles with helper functions for role checks
 */
export function useUserRoles() {
  const {
    data: roles = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["user", "roles"],
    queryFn: fetchUserRoles,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
    retry: 1,
  });

  /**
   * Check if user has a specific role
   */
  const hasRole = (role: UserRole): boolean => {
    return roles.includes(role);
  };

  /**
   * Check if user is an admin
   */
  const isAdmin = hasRole("admin");

  /**
   * Check if user is an operator
   */
  const isOperator = hasRole("operator");

  /**
   * Check if user has admin or operator role
   */
  const canAccessAdmin = isAdmin || isOperator;

  return {
    roles,
    isLoading,
    error,
    hasRole,
    isAdmin,
    isOperator,
    canAccessAdmin,
  };
}
