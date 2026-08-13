import { db } from "@/db";
import { user, userRoles, listings, shipments } from "@/db/schema";
import { payments } from "@/db/schema/payments";
import { eq, sql, and, ne, gte, lt, desc, or } from "drizzle-orm";

// ========================================
// KPI Queries
// ========================================

/**
 * Get count of active users (distinct users with any role except admin/operator)
 */
export async function getActiveUsersCount(): Promise<number> {
  // Get users who are NOT admins, transporters, or operators
  // We consider "regular users" as anyone who isn't staff or a driver
  const result = await db
    .select({ count: sql<number>`count(DISTINCT ${user.id})` })
    .from(user)
    .where(
      and(
        // Not banned (optional, but "active" usually implies not banned)
        eq(user.banned, false),
        // Exclude users who have admin/transporter/operator roles
        sql`NOT EXISTS (
          SELECT 1 FROM ${userRoles}
          WHERE ${userRoles.userId} = ${user.id}
          AND ${userRoles.role} IN ('admin', 'transporter', 'operator')
        )`
      )
    );

  return Number(result[0]?.count) || 0;
}

/**
 * Get count of active drivers (users with transporter role)
 */
export async function getActiveDriversCount(): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(DISTINCT ${userRoles.userId})` })
    .from(userRoles)
    .where(eq(userRoles.role, "carrier"));

  return Number(result[0]?.count) || 0;
}

/**
 * Get count of pending deliveries (shipments not delivered or cancelled)
 */
export async function getPendingDeliveriesCount(): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(shipments)
    .where(
      and(ne(shipments.status, "DELIVERED"), ne(shipments.status, "CANCELLED"))
    );

  return Number(result[0]?.count) || 0;
}

/**
 * Get total GMV (sum of currentPrice for sold listings)
 */
export async function getTotalGMV(): Promise<number> {
  const result = await db
    .select({ total: sql<number>`COALESCE(SUM(${shipments.priceCents}), 0)` })
    .from(shipments)
    .where(eq(shipments.status, "DELIVERED"));

  return Number(result[0]?.total) || 0;
}

/**
 * Get GMV for a specific month
 */
export async function getMonthlyGMV(
  year: number,
  month: number
): Promise<number> {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);

  const result = await db
    .select({ total: sql<number>`COALESCE(SUM(${shipments.priceCents}), 0)` })
    .from(shipments)
    .where(
      and(
        eq(shipments.status, "DELIVERED"),
        gte(shipments.updatedAt, startDate),
        lt(shipments.updatedAt, endDate)
      )
    );

  return Number(result[0]?.total) || 0;
}

/**
 * Get total platform app fees (gross, before Stripe processing fees)
 * Note: Actual net amount after Stripe fees can be viewed in Stripe Dashboard
 */
export async function getTotalAppFees(): Promise<number> {
  const result = await db
    .select({
      total: sql<number>`COALESCE(SUM(${payments.commissionCents}), 0)`,
    })
    .from(payments)
    .where(eq(payments.status, "captured"));

  return Number(result[0]?.total) || 0;
}

/**
 * Get monthly platform app fees (gross, before Stripe processing fees)
 */
export async function getMonthlyAppFees(
  year: number,
  month: number
): Promise<number> {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);

  const result = await db
    .select({
      total: sql<number>`COALESCE(SUM(${payments.commissionCents}), 0)`,
    })
    .from(payments)
    .where(
      and(
        eq(payments.status, "captured"),
        gte(payments.createdAt, startDate),
        lt(payments.createdAt, endDate)
      )
    );

  return Number(result[0]?.total) || 0;
}

/**
 * Get user count for a specific month (new registrations)
 */
export async function getMonthlyNewUsersCount(
  year: number,
  month: number
): Promise<number> {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(user)
    .where(and(gte(user.createdAt, startDate), lt(user.createdAt, endDate)));

  return Number(result[0]?.count) || 0;
}

/**
 * Get driver count for a specific month
 */
export async function getMonthlyNewDriversCount(
  year: number,
  month: number
): Promise<number> {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(userRoles)
    .where(
      and(
        eq(userRoles.role, "carrier"),
        gte(userRoles.assignedAt, startDate),
        lt(userRoles.assignedAt, endDate)
      )
    );

  return Number(result[0]?.count) || 0;
}

/**
 * Get pending deliveries count for a specific month
 */
export async function getMonthlyPendingDeliveriesCount(
  year: number,
  month: number
): Promise<number> {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(shipments)
    .where(
      and(
        ne(shipments.status, "DELIVERED"),
        ne(shipments.status, "CANCELLED"),
        gte(shipments.createdAt, startDate),
        lt(shipments.createdAt, endDate)
      )
    );

  return Number(result[0]?.count) || 0;
}

// ========================================
// Activity Queries
// ========================================

/**
 * Get recent users (for activity feed)
 */
export async function getRecentUsers(limit: number = 5) {
  return db.query.user.findMany({
    orderBy: desc(user.createdAt),
    limit,
  });
}

/**
 * Get recent listings (for activity feed)
 */
export async function getRecentListings(limit: number = 5) {
  return db.query.listings.findMany({
    with: {
      shipper: true,
    },
    orderBy: desc(listings.createdAt),
    limit,
  });
}

/**
 * Get recent delivered shipments (for activity feed)
 */
export async function getRecentDeliveredShipments(limit: number = 5) {
  return db.query.shipments.findMany({
    where: eq(shipments.status, "DELIVERED"),
    with: {
      driver: true,
    },
    orderBy: desc(shipments.deliveredAt),
    limit,
  });
}

// ========================================
// User Status Operations
// ========================================

/**
 * Update user banned status
 */
export async function updateUserBannedStatus(userId: string, banned: boolean) {
  const [updatedUser] = await db
    .update(user)
    .set({
      banned: banned,
      updatedAt: new Date(),
    })
    .where(eq(user.id, userId))
    .returning();

  return updatedUser;
}

/**
 * Get user by ID (simple)
 */
export async function getUserById(userId: string) {
  return db.query.user.findFirst({
    where: eq(user.id, userId),
  });
}
