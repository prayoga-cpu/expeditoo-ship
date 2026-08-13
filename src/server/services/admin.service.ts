import * as adminDal from "@/server/dal/admin.dal";
import * as usersDal from "@/server/dal/users.dal";
import type {
  DashboardStatsData,
  ActivityItem,
  UpdatedUserData,
} from "@/server/dto/admin.dto";

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
    const sellerName = listing.seller?.name || "Unknown Seller";
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
// User Status Management Service
// ========================================

/**
 * Update user banned status
 */
export async function updateUserStatus(
  userId: string,
  banned: boolean,
  adminId: string
): Promise<UpdatedUserData> {
  // Prevent self-ban
  if (userId === adminId) {
    throw new Error("SELF_BAN_NOT_ALLOWED");
  }

  // Check if user exists
  const existingUser = await usersDal.getUserById(userId);
  if (!existingUser) {
    throw new Error("USER_NOT_FOUND");
  }

  // Update user status
  const updatedUser = await adminDal.updateUserBannedStatus(userId, banned);

  if (!updatedUser) {
    throw new Error("UPDATE_FAILED");
  }

  return {
    id: updatedUser.id,
    name: updatedUser.name,
    email: updatedUser.email,
    banned: updatedUser.banned,
    updatedAt: updatedUser.updatedAt.toISOString(),
  };
}
