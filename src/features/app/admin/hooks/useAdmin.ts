import { useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { User } from "../types";
import { mapApiUser } from "../lib/map-api-user";
import { assignRole, fetchUsers, removeRole } from "../api/users.api";
import { dbRolesFor } from "../lib/role-groups";

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

  /** Additive — a role picked here joins whatever the account already holds
   * (assignRole.ts, non-replace branch). Assigning was silently replacing
   * every existing role until this changed, one `replace: true` away from
   * the copy right beside it in the dialog promising the opposite.
   *
   * `role` is a manageable chip, not always a raw `user_roles` value —
   * `dbRolesFor` expands "driver" to both `carrier` and `driver` so the pair
   * is always granted together, the same way KYC approval already does
   * (`carrier.service.ts`). The two calls run in sequence, not in parallel,
   * so a real failure on the first stops the second rather than leaving the
   * pair half-granted. */
  const handleUpdateRole = useCallback(
    async (role: string) => {
      if (!selectedUser) return;

      setIsUpdatingRole(true);
      try {
        for (const dbRole of dbRolesFor(role)) {
          await assignRole(selectedUser.id, dbRole);
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

  /** The server refuses to take an account's last role, and answers with a
   * message rather than an HTTP error for that case — surfaced by the
   * caller, not swallowed here.
   *
   * Removing the "driver" chip removes both `carrier` and `driver`. The
   * dialog and the table only offer this when another manageable chip is
   * still held, so the second call should not itself be a user's last role
   * — but if a race makes it one anyway, that failure (not the first call's
   * success) is what the caller needs to see. */
  const handleRemoveRole = useCallback(
    async (userId: string, role: string) => {
      let result = { success: true, message: "" };
      for (const dbRole of dbRolesFor(role)) {
        result = await removeRole(userId, dbRole);
      }
      await refetch();
      return result;
    },
    [refetch]
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
    handleRemoveRole,
    isLoading,
    refetchUsers: refetch,
  };
}
