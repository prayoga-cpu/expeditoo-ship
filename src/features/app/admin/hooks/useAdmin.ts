import { useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { User } from "../types";
import { mapApiUser } from "../lib/map-api-user";
import { fetchUsers } from "../api/users.api";

/**
 * The admin users table.
 *
 * Reads under the `["admin", "users"]` key, which is what every moderation
 * mutation invalidates -- before this the list was local state fetched once,
 * so suspending or deleting somebody left the row on screen unchanged.
 */
export function useAdmin() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTab, setSelectedTab] = useState("users");
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);

  const {
    data: users = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: async () => {
      const result = await fetchUsers();
      return result.users.map(mapApiUser);
    },
  });

  const filteredUsers = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return users.filter(
      (user) =>
        user.name?.toLowerCase().includes(query) ||
        user.email?.toLowerCase().includes(query)
    );
  }, [users, searchQuery]);

  const handleUpdateRole = useCallback(
    async (role: string) => {
      if (!selectedUser) return;

      setIsUpdatingRole(true);
      try {
        const response = await fetch("/api/user/roles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: selectedUser.id,
            role,
            replace: true,
          }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error?.message || "Failed to update role");
        }

        await refetch();
        setRoleDialogOpen(false);
      } catch (error) {
        console.error("Failed to update role:", error);
      } finally {
        setIsUpdatingRole(false);
      }
    },
    [selectedUser, refetch]
  );

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
    refetchUsers: refetch,
  };
}
