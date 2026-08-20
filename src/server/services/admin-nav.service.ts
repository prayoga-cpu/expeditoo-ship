import {
  getAdminNavCounts,
  type AdminNavCounts,
} from "@/server/dal/admin-nav.dal";
import { AdminError } from "@/server/services/admin.service";
import type { Viewer } from "@/server/services/shipment.service";

/**
 * The sidebar badges.
 *
 * A service rather than a route body because the counts are permission-bearing:
 * they say how many carrier applications are unreviewed and how much money is
 * waiting to move, which is admin-only information even though each figure is a
 * single integer (docs/rules.md §8).
 *
 * Every count is either work waiting on staff or how much arrived recently —
 * never a vanity total. A badge that never reaches zero teaches the operator to
 * stop reading badges.
 */
export const adminNavService = {
  async counts(viewer: Viewer): Promise<AdminNavCounts> {
    if (!viewer.isAdmin && !viewer.isOperator) {
      throw new AdminError("FORBIDDEN_ROLE", "Admin access required", 403);
    }

    return await getAdminNavCounts(viewer.userId);
  },
};

export type { AdminNavCounts };
