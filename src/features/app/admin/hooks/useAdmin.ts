import { useState, useCallback, useMemo, useEffect } from "react";
import type { User } from "../types";

/**
 * Admin hook for user management
 * Uses real API for all data
 */
export function useAdmin() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTab, setSelectedTab] = useState("users");
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);

  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/users?pageSize=100");
      if (response.ok) {
        const data = await response.json();
        // Map API response to UI User type
        interface ApiUser {
          id: string;
          name?: string;
          email: string;
          roles?: string[];
          emailVerified?: boolean;
          createdAt?: string;
        }

        const mappedUsers: User[] = (data.data?.users || []).map((u: ApiUser) => {
          const roles = u.roles || [];
          // Determine primary role for UI
          let role = "user";
          if (roles.includes("admin")) role = "admin";
          else if (roles.includes("driver") || roles.includes("carrier"))
            role = "driver";
          else if (roles.length > 0) role = roles[0];

          return {
            id: u.id,
            name: u.name || "Unknown",
            email: u.email,
            role: role,
            // Derive status (since we don't have it in DB user table yet)
            // For now, assume emailVerified means active
            status: u.emailVerified ? "active" : "inactive",
            joinDate: u.createdAt
              ? new Date(u.createdAt).toISOString().split("T")[0]
              : new Date().toISOString().split("T")[0],
          };
        });
        setUsers(mappedUsers);
      }
    } catch (error) {
      console.error("Failed to fetch users", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const filteredUsers = useMemo(() => {
    return users.filter(
      (user) =>
        user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [users, searchQuery]);

  const handleUpdateRole = useCallback(async (role: string) => {
    if (!selectedUser) return;

    setIsUpdatingRole(true);
    try {
      // Call API to assign role
      const response = await fetch("/api/user/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUser.id,
          role: role,
          replace: true,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to update role");
      }

      // Refetch users to reflect changes
      await fetchUsers();
      setRoleDialogOpen(false);
    } catch (error) {
      console.error("Failed to update role:", error);
      // You could add toast notification here
    } finally {
      setIsUpdatingRole(false);
    }
  }, [selectedUser, fetchUsers]);

  return {
    searchQuery,
    setSearchQuery,
    selectedTab,
    setSelectedTab,
    roleDialogOpen,
    setRoleDialogOpen,
    selectedUser,
    setSelectedUser,
    isUpdatingRole,
    users: filteredUsers,
    handleUpdateRole,
    isLoading,
  };
}
