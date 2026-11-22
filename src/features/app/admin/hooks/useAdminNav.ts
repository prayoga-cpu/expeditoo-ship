import { useCallback, useMemo } from "react";

import { useAuth } from "@/lib/auth-context";
import {
  adminLandingFor,
  canOpenAdminPath,
  canReadAdminNavCounts,
} from "@/lib/admin-access";

import { adminNavFor } from "../nav";
import { useAdminNavCounts } from "./useAdminNavCounts";

/**
 * The back-office navigation for the signed-in account: the entries its roles
 * may open, the page its logo leads to, and the badge counts — asked for only
 * when the service would answer them.
 *
 * Roles come from the session (`customSession` reads `user_roles` per
 * request). Nothing here grants anything: the proxy and every service decide
 * again. While the session loads the roles are empty and so is the list — a
 * blank sidebar for a beat rather than entries that then disappear.
 */
export function useAdminNav() {
  const { user } = useAuth();
  // Joined so the memo follows the roles' content, not the array's identity.
  const roleKey = (user?.roles ?? []).join(",");

  const { groups, landing, countsEnabled } = useMemo(() => {
    const roles = roleKey ? roleKey.split(",") : [];
    return {
      groups: adminNavFor(roles),
      landing: adminLandingFor(roles),
      countsEnabled: canReadAdminNavCounts(roles),
    };
  }, [roleKey]);

  const counts = useAdminNavCounts({ enabled: countsEnabled });
  const canOpen = useCallback(
    (path: string) => canOpenAdminPath(roleKey ? roleKey.split(",") : [], path),
    [roleKey]
  );

  return { groups, landing, counts, canOpen };
}
