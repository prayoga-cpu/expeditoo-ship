import { useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import type { User } from "../types";
import { mapApiUser } from "../lib/map-api-user";
import { assignRole, fetchUsers, removeRole } from "../api/users.api";
import { dbRolesFor } from "../lib/role-groups";
import { useToast } from "@/hooks/use-toast";

/**
 * The admin users table.
 *
 * Reads under the `["admin", "users"]` key, which is what every moderation
 * mutation invalidates -- before this the list was local state fetched once,
 * so suspending or deleting somebody left the row on screen unchanged.
 */
export function useAdmin() {
  const { toast } = useToast();
  const tMessages = useTranslations("admin.users.messages");
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
   * « In-house driver » and « Carrier » are granted here too: the server
   * creates or approves the driver file that earns the role, so the person
   * shows up in the Drivers list at once (driver_types_spec.md §5). A refusal
   * (a suspended file, say) comes back as `success: false`; the toast is the
   * catalogue's sentence, because the server's `message` is English. */
  const handleUpdateRole = useCallback(
    async (role: string) => {
      if (!selectedUser) return;

      setIsUpdatingRole(true);
      try {
        for (const dbRole of dbRolesFor(role)) {
          const result = await assignRole(selectedUser.id, dbRole);
          if (!result.success) {
            toast({ description: tMessages("errorDesc"), variant: "destructive" });
            return;
          }
        }
        await refetch();
        setRoleDialogOpen(false);
      } catch (error) {
        console.error("Failed to update role:", error);
        toast({ description: tMessages("errorDesc"), variant: "destructive" });
      } finally {
        setIsUpdatingRole(false);
      }
    },
    [selectedUser, refetch, toast, tMessages]
  );

  /** The server refuses to take an account's last role, and answers with a
   * message rather than an HTTP error for that case — surfaced by the
   * caller, not swallowed here.
   *
   * Removing a chip removes only that role; the driver file stays as it is. */
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
