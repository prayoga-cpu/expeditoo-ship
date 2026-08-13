import { useQuery } from "@tanstack/react-query";

interface ApiResponse {
  success: boolean;
  data?: { roles: string[] };
  error?: { code: string; message: string };
}

async function fetchUserRoles(): Promise<string[]> {
  const response = await fetch("/api/user/roles");
  if (!response.ok) {
    throw new Error("Failed to fetch user roles");
  }
  const result: ApiResponse = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.error?.message || "Failed to fetch user roles");
  }
  return result.data.roles;
}

export function useUserRoles() {
  return useQuery({
    queryKey: ["user-roles"],
    queryFn: fetchUserRoles,
  });
}
