import { db } from "@/db";
import {
  user,
  userRoles,
  type InsertUser,
  type UserRoleEnum,
} from "@/db/schema";
import { eq, and, ilike, or, desc, asc, sql, inArray } from "drizzle-orm";

// ========================================
// User CRUD Operations
// ========================================

/**
 * Get user by ID with roles
 */
export async function getUserById(id: string) {
  return db.query.user.findFirst({
    where: eq(user.id, id),
    with: {
      roles: true,
    },
  });
}

/**
 * Get user by email with roles
 */
export async function getUserByEmail(email: string) {
  return db.query.user.findFirst({
    where: eq(user.email, email.toLowerCase()),
    with: {
      roles: true,
    },
  });
}

/**
 * Create new user
 */
export async function createUser(data: Omit<InsertUser, "id" | "createdAt" | "updatedAt">) {
  const [newUser] = await db
    .insert(user)
    .values({
      ...data,
      id: crypto.randomUUID(),
      email: data.email.toLowerCase(),
      // Ensure emailVerified is boolean if schema expects boolean
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  return newUser;
}

/**
 * Update user by ID
 */
export async function updateUser(
  id: string,
  data: Partial<Omit<InsertUser, "id" | "createdAt">>
) {
  const [updatedUser] = await db
    .update(user)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(user.id, id))
    .returning();

  return updatedUser;
}

/**
 * Update user email verified status
 */
export async function verifyUserEmail(id: string) {
  const [updatedUser] = await db
    .update(user)
    .set({
      emailVerified: true, // Changed to boolean
      updatedAt: new Date(),
    })
    .where(eq(user.id, id))
    .returning();

  return updatedUser;
}

/**
 * Delete user by ID (hard delete)
 */
export async function deleteUser(id: string) {
  await db.delete(user).where(eq(user.id, id));
}

/**
 * Check if user exists by email
 */
export async function userExistsByEmail(email: string): Promise<boolean> {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(user)
    .where(eq(user.email, email.toLowerCase()));

  return Number(result[0]?.count) > 0;
}

// ========================================
// User Roles Operations
// ========================================

/**
 * Get all roles for a user
 */
export async function getUserRoles(userId: string) {
  return db.query.userRoles.findMany({
    where: eq(userRoles.userId, userId),
  });
}

/**
 * Check if user has specific role
 */
export async function userHasRole(userId: string, role: string): Promise<boolean> {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(userRoles)
    .where(and(eq(userRoles.userId, userId), eq(userRoles.role, role as UserRoleEnum)));

  return Number(result[0]?.count) > 0;
}

type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Idempotent, transaction-aware role grant. `assignRole` throws on a repeat,
 * which is wrong for a flow that grants several roles at once and has to stay
 * re-runnable; here an existing grant counts as success. There is no unique
 * constraint on (user_id, role), so the check is a read inside the caller's
 * transaction rather than an upsert.
 */
export async function assignRoleIfMissing(
  userId: string,
  role: UserRoleEnum,
  assignedBy: string | null,
  tx: Executor = db
) {
  const existing = await tx.query.userRoles.findFirst({
    where: and(eq(userRoles.userId, userId), eq(userRoles.role, role)),
  });
  if (existing) return existing;

  const [granted] = await tx
    .insert(userRoles)
    .values({
      id: crypto.randomUUID(),
      userId,
      role,
      assignedBy,
      assignedAt: new Date(),
    })
    .returning();

  return granted;
}

/**
 * Assign role to user
 */
export async function assignRole(
  userId: string,
  role: string,
  assignedBy?: string
) {
  // Check if role already exists
  const exists = await userHasRole(userId, role);
  if (exists) {
    throw new Error(`User already has role '${role}'`);
  }

  const [userRole] = await db
    .insert(userRoles)
    .values({
      id: crypto.randomUUID(),
      userId,
      role: role as UserRoleEnum,
      assignedBy: assignedBy || null,
      assignedAt: new Date(),
    })
    .returning();

  return userRole;
}

/**
 * Remove role from user
 */
export async function removeRole(userId: string, role: string) {
  // Check if this is the user's last role
  const roles = await getUserRoles(userId);
  if (roles.length <= 1) {
    throw new Error("Cannot remove last role. User must have at least one role.");
  }

  await db
    .delete(userRoles)
    .where(and(eq(userRoles.userId, userId), eq(userRoles.role, role as UserRoleEnum)));
}

/**
 * Replace all user roles with a single new role
 */
export async function replaceUserRole(
  userId: string,
  role: string,
  assignedBy?: string
) {
  return await db.transaction(async (tx) => {
    // Delete all existing roles
    await tx.delete(userRoles).where(eq(userRoles.userId, userId));

    // Insert new role
    const [userRole] = await tx
      .insert(userRoles)
      .values({
        id: crypto.randomUUID(),
        userId,
        role: role as UserRoleEnum,
        assignedBy: assignedBy || null,
        assignedAt: new Date(),
      })
      .returning();

    return userRole;
  });
}

/**
 * Remove all roles from user
 */
export async function removeAllRoles(userId: string) {
  await db.delete(userRoles).where(eq(userRoles.userId, userId));
}

// ========================================
// User Queries (Admin/Listing)
// ========================================

interface GetUsersOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  role?: string;
  emailVerified?: boolean;
  sortBy?: "createdAt" | "name" | "email";
  sortOrder?: "asc" | "desc";
}

/**
 * Get users with pagination and filters
 */
export async function getUsers(options: GetUsersOptions = {}) {
  const {
    page = 1,
    pageSize = 20,
    search,
    role,
    emailVerified,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = options;

  const offset = (page - 1) * pageSize;

  // Build where conditions
  const whereConditions = [];

  if (search) {
    whereConditions.push(
      or(
        ilike(user.email, `%${search}%`),
        ilike(user.name, `%${search}%`)
      )
    );
  }

  if (emailVerified !== undefined) {
    if (emailVerified) {
      whereConditions.push(eq(user.emailVerified, true));
    } else {
      whereConditions.push(eq(user.emailVerified, false));
    }
  }

  if (role) {
    const subQuery = db
      .select({ userId: userRoles.userId })
      .from(userRoles)
      .where(eq(userRoles.role, role as UserRoleEnum));

    whereConditions.push(inArray(user.id, subQuery));
  }

  // Build query
  const results = await db.query.user.findMany({
    where: whereConditions.length > 0 ? and(...whereConditions) : undefined,
    with: {
      roles: true,
    },
    limit: pageSize,
    offset,
    orderBy:
      sortOrder === "asc"
        ? asc(user[sortBy])
        : desc(user[sortBy]),
  });

  const filteredResults = results;

  // Get total count
  const totalQuery = await db
    .select({ count: sql<number>`count(*)` })
    .from(user)
    .where(whereConditions.length > 0 ? and(...whereConditions) : undefined);

  const total = Number(totalQuery[0]?.count) || 0;
  const totalPages = Math.ceil(total / pageSize);

  return {
    users: filteredResults,
    total,
    page,
    pageSize,
    totalPages,
  };
}

/**
 * Get total user count
 */
export async function getTotalUserCount(): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(user);

  return Number(result[0]?.count) || 0;
}

/**
 * Get user count by role
 */
export async function getUserCountByRole(role: string): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(userRoles)
    .where(eq(userRoles.role, role as UserRoleEnum));

  return Number(result[0]?.count) || 0;
}

/**
 * Get recently registered users
 */
export async function getRecentUsers(limit: number = 10) {
  return db.query.user.findMany({
    with: {
      roles: true,
    },
    limit,
    orderBy: desc(user.createdAt),
  });
}

// ========================================
// Batch Operations
// ========================================

/**
 * Assign default role to new user
 *
 * Every fresh account starts as a shipper: posting a job needs no vetting,
 * while `carrier`/`driver` are only granted through the KYC flow. ("buyer"
 * was the v1 goods-marketplace default and no longer exists in the enum.)
 */
export async function assignDefaultRole(userId: string) {
  return assignRole(userId, "shipper");
}

/**
 * Get users by role
 */
export async function getUsersByRole(role: string) {
  const roleRecords = await db.query.userRoles.findMany({
    where: eq(userRoles.role, role as UserRoleEnum),
    with: {
      user: true,
    },
  });

  return roleRecords.map((record) => record.user);
}

/**
 * Denormalised rating on the user row, refreshed after each review so listing
 * and offer queries can sort by reputation without joining the reviews table.
 */
export async function updateUserRating(userId: string, rating: number) {
  const [result] = await db
    .update(user)
    .set({ rating, updatedAt: new Date() })
    .where(eq(user.id, userId))
    .returning();
  return result;
}
