import * as adminDal from "@/server/dal/admin.dal";
import * as usersDal from "@/server/dal/users.dal";
import * as sessionsDal from "@/server/dal/sessions.dal";
import {
  deletionRefusal,
  holdsAdmin,
  suspensionRefusal,
} from "@/server/services/account-policy";
import type {
  DashboardStatsData,
  ActivityItem,
  UpdatedUserData,
} from "@/server/dto/admin.dto";

/**
 * Errors from the admin surface. `src/lib/api-response.ts` turns these into
 * the response body, so a route never has to translate a code by hand.
 */
export class AdminError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "AdminError";
  }
}

// ========================================
// Helper Functions
// ========================================

/**
 * Get month name from month number (0-11)
 */
function getMonthName(month: number): string {
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return months[month] || "Unknown";
}

/**
 * Calculate percentage change between two values
 */
function calculateChangePercentage(current: number, previous: number): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return Math.round(((current - previous) / previous) * 100 * 10) / 10;
}

/**
 * Get user initials from name
 */
function getInitials(name: string): string {
  if (!name) return "??";
  const parts = name.trim().split(" ");
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ========================================
// Dashboard Stats Service
// ========================================

/**
 * Get dashboard statistics with KPIs and charts
 */
export async function getDashboardStats(): Promise<DashboardStatsData> {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12
  const previousMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const previousYear = currentMonth === 1 ? currentYear - 1 : currentYear;

  // Get current values
  const [totalRevenue, activeUsers, activeDrivers, pendingDeliveries] =
    await Promise.all([
      adminDal.getTotalAppFees(),
      adminDal.getActiveUsersCount(),
      adminDal.getActiveDriversCount(),
      adminDal.getPendingDeliveriesCount(),
    ]);

  // Get previous month values for comparison
  const [previousRevenue, previousUsers, previousDrivers, previousDeliveries] =
    await Promise.all([
      adminDal.getMonthlyAppFees(previousYear, previousMonth),
      adminDal.getMonthlyNewUsersCount(previousYear, previousMonth),
      adminDal.getMonthlyNewDriversCount(previousYear, previousMonth),
      adminDal.getMonthlyPendingDeliveriesCount(previousYear, previousMonth),
    ]);

  // Get current month values for comparison
  const [
    currentMonthRevenue,
    currentMonthUsers,
    currentMonthDrivers,
    currentMonthDeliveries,
  ] = await Promise.all([
    adminDal.getMonthlyAppFees(currentYear, currentMonth),
    adminDal.getMonthlyNewUsersCount(currentYear, currentMonth),
    adminDal.getMonthlyNewDriversCount(currentYear, currentMonth),
    adminDal.getMonthlyPendingDeliveriesCount(currentYear, currentMonth),
  ]);

  // Build revenue chart data (last 6 months)
  const revenueChartData = [];
  for (let i = 5; i >= 0; i--) {
    let targetMonth = currentMonth - i;
    let targetYear = currentYear;

    if (targetMonth <= 0) {
      targetMonth += 12;
      targetYear -= 1;
    }

    const monthRevenue = await adminDal.getMonthlyAppFees(
      targetYear,
      targetMonth
    );
    revenueChartData.push({
      name: getMonthName(targetMonth - 1),
      total: monthRevenue,
    });
  }

  return {
    kpi: {
      totalRevenue: {
        value: totalRevenue,
        changePercentage: calculateChangePercentage(
          currentMonthRevenue,
          previousRevenue
        ),
      },
      activeUsers: {
        value: activeUsers,
        changePercentage: calculateChangePercentage(
          currentMonthUsers,
          previousUsers
        ),
      },
      activeDrivers: {
        value: activeDrivers,
        changePercentage: calculateChangePercentage(
          currentMonthDrivers,
          previousDrivers
        ),
      },
      pendingDeliveries: {
        value: pendingDeliveries,
        changePercentage: calculateChangePercentage(
          currentMonthDeliveries,
          previousDeliveries
        ),
      },
    },
    charts: {
      revenue: revenueChartData,
    },
  };
}

// ========================================
// Activity Feed Service
// ========================================

/**
 * Get recent activity feed
 */
export async function getRecentActivity(): Promise<ActivityItem[]> {
  const [recentUsers, recentListings, recentDeliveries] = await Promise.all([
    adminDal.getRecentUsers(5),
    adminDal.getRecentListings(5),
    adminDal.getRecentDeliveredShipments(5),
  ]);

  const activities: ActivityItem[] = [];

  // Map new users to activity items
  for (const u of recentUsers) {
    activities.push({
      id: u.id,
      user: u.name || "Unknown User",
      action: "joined the platform",
      target: "New Member",
      time: u.createdAt.toISOString(),
      avatar: getInitials(u.name || ""),
    });
  }

  // Map new listings to activity items
  for (const listing of recentListings) {
    const sellerName = listing.shipper?.name || "Unknown Seller";
    activities.push({
      id: listing.id,
      user: sellerName,
      action: "listed a new item",
      target: listing.title,
      time: listing.createdAt.toISOString(),
      avatar: getInitials(sellerName),
    });
  }

  // Map delivered shipments to activity items
  for (const shipment of recentDeliveries) {
    const driverName = shipment.driver?.name || "Unknown Driver";
    activities.push({
      id: shipment.id,
      user: driverName,
      action: "completed delivery",
      target: `#${shipment.id.substring(0, 8).toUpperCase()}`,
      time: (shipment.deliveredAt || shipment.updatedAt).toISOString(),
      avatar: getInitials(driverName),
    });
  }

  // Sort by time descending and take top 10
  activities.sort(
    (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()
  );

  return activities.slice(0, 10);
}

// ========================================
// User Moderation
// ========================================
// Permission lives here, not in the route (docs/rules.md §3): every one of
// these is destructive enough that "the route in front of it checks" is not
// a guarantee worth relying on.

/** Throw unless the actor holds `admin` in user_roles. */
async function assertAdmin(adminId: string) {
  const actor = await usersDal.getUserById(adminId);

  if (!actor || !holdsAdmin(actor.roles)) {
    throw new AdminError("NOT_ADMIN", "Admin access required", 403);
  }

  return actor;
}

/** The user the action targets, or a 404. */
async function loadTarget(userId: string) {
  const target = await usersDal.getUserById(userId);

  if (!target) {
    throw new AdminError("USER_NOT_FOUND", "User not found", 404);
  }

  return target;
}

/**
 * Suspend or reinstate a user.
 *
 * Suspending also drops their live sessions. Writing `banned` alone only
 * blocks the *next* sign-in, which meant a suspended user carried on working
 * inside the session they already had -- for up to a week.
 */
export async function updateUserStatus(
  userId: string,
  banned: boolean,
  adminId: string
): Promise<UpdatedUserData> {
  await assertAdmin(adminId);

  const target = await loadTarget(userId);
  const refusal = suspensionRefusal(adminId, target);

  if (refusal) {
    throw new AdminError(refusal.code, refusal.message, refusal.status);
  }

  const updatedUser = await adminDal.updateUserBannedStatus(userId, banned);

  if (!updatedUser) {
    throw new AdminError("UPDATE_FAILED", "Failed to update user", 500);
  }

  if (banned) {
    // The user's own sessions, not an admin's view of them: suspending an
    // account somebody is looking at should not eject the person looking.
    await sessionsDal.deleteUserSessions(userId, { keepImpersonated: true });
  }

  return {
    id: updatedUser.id,
    name: updatedUser.name,
    email: updatedUser.email,
    banned: updatedUser.banned,
    updatedAt: updatedUser.updatedAt.toISOString(),
  };
}

/**
 * Sign a user out of every device.
 *
 * "Every device" means theirs. An impersonation another admin is holding is
 * left alone -- it is capped at an hour of its own and is recorded in
 * `impersonation_sessions`, whereas killing it would drop that admin on the
 * sign-in screen with no explanation.
 */
export async function revokeUserSessions(
  userId: string,
  adminId: string
): Promise<{ revoked: number }> {
  await assertAdmin(adminId);
  await loadTarget(userId);

  const revoked = await sessionsDal.deleteUserSessions(userId, {
    keepImpersonated: true,
  });

  return { revoked };
}

/**
 * Delete a user and everything that hangs off them.
 *
 * Irreversible: every foreign key into `user` is ON DELETE CASCADE or SET
 * NULL, so listings, offers, shipments, payments, messages, reviews and the
 * carrier profile go with the row.
 */
export async function deleteUserAccount(
  userId: string,
  adminId: string
): Promise<{ id: string; email: string }> {
  await assertAdmin(adminId);

  const target = await loadTarget(userId);
  const refusal = deletionRefusal(adminId, target);

  if (refusal) {
    throw new AdminError(refusal.code, refusal.message, refusal.status);
  }

  await usersDal.deleteUser(userId);

  return { id: target.id, email: target.email };
}

/**
 * Send the user a password reset link.
 *
 * Better Auth owns token generation and the mail callback, so this asks it
 * rather than minting a token of its own. The import is deferred because
 * src/lib/auth.ts pulls in the whole auth stack, and nothing else in this
 * service needs it.
 */
export async function sendPasswordResetForUser(
  userId: string,
  adminId: string
): Promise<{ email: string }> {
  await assertAdmin(adminId);

  const target = await loadTarget(userId);
  const { auth } = await import("@/lib/auth");

  await auth.api.requestPasswordReset({
    body: {
      email: target.email,
      redirectTo: "/reset-password",
    },
  });

  return { email: target.email };
}
