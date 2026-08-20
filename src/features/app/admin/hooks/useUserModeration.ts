import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as usersApi from "../api/users.api";

/**
 * Every admin action on a user, as mutations that invalidate the same
 * `["admin", "users"]` key the users table reads from.
 */

function useAdminUserMutation<TArgs, TResult>(
  mutationFn: (args: TArgs) => Promise<TResult>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "activity"] });
    },
  });
}

/** Suspend or reinstate. Suspending also ends the user's live sessions. */
export function useUpdateUserStatus() {
  return useAdminUserMutation((params: { userId: string; banned: boolean }) =>
    usersApi.updateUserStatus(params.userId, params.banned)
  );
}

/** Delete the account and everything cascading from it. Irreversible. */
export function useDeleteUser() {
  return useAdminUserMutation((userId: string) => usersApi.deleteUser(userId));
}

/** Sign the user out of every device. */
export function useRevokeUserSessions() {
  return useAdminUserMutation((userId: string) =>
    usersApi.revokeUserSessions(userId)
  );
}

/** Mail the user a password reset link. */
export function useSendPasswordReset() {
  return useAdminUserMutation((userId: string) =>
    usersApi.sendPasswordReset(userId)
  );
}

/**
 * Borrow the user's session.
 *
 * Deliberately not a plain mutation callback: the cookie has changed by the
 * time this resolves, so every cached query belongs to the previous identity
 * and the caller reloads the page rather than trying to reconcile them.
 */
export function useImpersonateUser() {
  return useMutation({
    mutationFn: (userId: string) => usersApi.impersonateUser(userId),
  });
}

/** Hand the admin back their own session. */
export function useStopImpersonating() {
  return useMutation({
    mutationFn: () => usersApi.stopImpersonating(),
  });
}
