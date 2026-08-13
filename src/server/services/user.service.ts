import * as usersDAL from "@/server/dal/users.dal";
import { UserPreferences, defaultPreferences } from "@/db/schema";
import {
  userOutputSchema,
  updateProfileInputSchema,
  assignRoleInputSchema,
  removeRoleInputSchema,
  getUserQuerySchema,
  type UserOutput,
  type UserListOutput,
} from "@/server/dto/user.dto";

// ========================================
// Preference Utilities
// ========================================

/**
 * Deep merge preferences with proper nested object handling
 */
function mergePreferences(
  current: UserPreferences,
  updates: Partial<UserPreferences>
): UserPreferences {
  return {
    ...current,
    ...updates,
    notifications: {
      ...current.notifications,
      ...(updates.notifications || {}),
      email: {
        ...current.notifications.email,
        ...(updates.notifications?.email || {}),
      },
    },
  };
}

// ========================================
// User Preferences
// ========================================

/**
 * Update user notification preferences
 */
export async function updatePreferences(
  userId: string,
  updates: Partial<UserPreferences>
) {
  const user = await usersDAL.getUserById(userId);
  if (!user) throw new Error("User not found");

  const currentPreferences = user.preferences || defaultPreferences;
  const newPreferences = mergePreferences(currentPreferences, updates);

  return usersDAL.updateUser(userId, { preferences: newPreferences });
}

// ========================================
// User Profile Operations
// ========================================

/**
 * Get user profile by ID with roles
 */
export async function getProfile(userId: string): Promise<UserOutput> {
  const user = await usersDAL.getUserById(userId);

  if (!user) {
    throw new Error("User not found");
  }

  // Transform to DTO format
  return userOutputSchema.parse({
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image,
    emailVerified: user.emailVerified,
    isVerified: user.isVerified,
    banned: user.banned,
    roles: user.roles.map((r: { role: string }) => r.role),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  });
}

/**
 * Update user profile
 */
export async function updateProfile(
  userId: string,
  input: unknown
): Promise<UserOutput> {
  // Validate input
  const validated = updateProfileInputSchema.parse(input);

  // Update user
  const updatedUser = await usersDAL.updateUser(userId, validated);

  if (!updatedUser) {
    throw new Error("Failed to update profile");
  }

  // Get fresh user data with roles
  return getProfile(userId);
}

// ========================================
// Role Management (Admin Only)
// ========================================

/**
 * Assign role to user
 */
export async function assignRole(
  input: unknown,
  adminId: string
): Promise<{ success: boolean; message: string }> {
  // Validate input
  const validated = assignRoleInputSchema.parse(input);

  // Verify admin has permission
  await verifyAdminPermission(adminId);

  // Check if target user exists
  const targetUser = await usersDAL.getUserById(validated.userId);
  if (!targetUser) {
    throw new Error("Target user not found");
  }

  // Assign role
  try {
    if (validated.replace) {
      await usersDAL.replaceUserRole(validated.userId, validated.role, adminId);
      return {
        success: true,
        message: `User role updated to '${validated.role}' successfully`,
      };
    } else {
      await usersDAL.assignRole(validated.userId, validated.role, adminId);
      return {
        success: true,
        message: `Role '${validated.role}' assigned to user successfully`,
      };
    }
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes("already has role")) {
      return {
        success: false,
        message: error.message,
      };
    }
    throw error;
  }
}

/**
 * Remove role from user
 */
export async function removeRole(
  input: unknown,
  adminId: string
): Promise<{ success: boolean; message: string }> {
  // Validate input
  const validated = removeRoleInputSchema.parse(input);

  // Verify admin has permission
  await verifyAdminPermission(adminId);

  // Check if target user exists
  const targetUser = await usersDAL.getUserById(validated.userId);
  if (!targetUser) {
    throw new Error("Target user not found");
  }

  // Remove role
  try {
    await usersDAL.removeRole(validated.userId, validated.role);

    return {
      success: true,
      message: `Role '${validated.role}' removed from user successfully`,
    };
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes("last role")) {
      return {
        success: false,
        message: error.message,
      };
    }
    throw error;
  }
}

/**
 * Verify user has admin role
 */
async function verifyAdminPermission(userId: string) {
  const user = await usersDAL.getUserById(userId);

  if (!user) {
    throw new Error("Admin user not found");
  }

  const isAdmin = user.roles.some((r: { role: string }) => r.role === "admin");

  if (!isAdmin) {
    throw new Error("Unauthorized: Admin role required");
  }
}

// ========================================
// User Queries (Admin)
// ========================================

/**
 * Get list of users with pagination and filters
 */
export async function getUsers(query: unknown, adminId: string): Promise<UserListOutput> {
  // Verify admin permission
  await verifyAdminPermission(adminId);

  // Validate query parameters
  const validated = getUserQuerySchema.parse(query);

  // Get users from DAL
  const result = await usersDAL.getUsers({
    page: validated.page,
    pageSize: validated.pageSize,
    search: validated.search,
    role: validated.role,
    emailVerified: validated.emailVerified === "true" ? true : validated.emailVerified === "false" ? false : undefined,
    sortBy: validated.sortBy,
    sortOrder: validated.sortOrder,
  });

  // Transform to DTO format
  return {
    users: result.users.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      emailVerified: user.emailVerified,
      isVerified: user.isVerified,
      banned: user.banned,
      roles: user.roles.map((r: { role: string }) => r.role as "buyer" | "seller" | "auctioneer" | "transporter" | "operator" | "admin"),
      createdAt: user.createdAt,
    })),
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
    totalPages: result.totalPages,
  };
}

/**
 * Get single user by ID (Admin)
 */
export async function getUserById(userId: string, adminId: string): Promise<UserOutput> {
  // Verify admin permission
  await verifyAdminPermission(adminId);

  return getProfile(userId);
}

/**
 * Delete user (Admin)
 */
export async function deleteUser(
  userId: string,
  adminId: string,
  _reason?: string
): Promise<{ success: boolean; message: string }> {
  // Verify admin permission
  await verifyAdminPermission(adminId);

  // Check if target user exists
  const targetUser = await usersDAL.getUserById(userId);
  if (!targetUser) {
    throw new Error("Target user not found");
  }

  // Prevent deleting admin users (safety)
  const isTargetAdmin = targetUser.roles.some((r: { role: string }) => r.role === "admin");
  if (isTargetAdmin) {
    throw new Error("Cannot delete admin users");
  }

  // Delete user
  await usersDAL.deleteUser(userId);

  return {
    success: true,
    message: "User deleted successfully",
  };
}

// ========================================
// User Utilities
// ========================================

/**
 * Check if user has specific role
 */
export async function hasRole(userId: string, role: string): Promise<boolean> {
  return usersDAL.userHasRole(userId, role);
}

/**
 * Check if user has any of the specified roles
 */
export async function hasAnyRole(userId: string, roles: string[]): Promise<boolean> {
  const user = await usersDAL.getUserById(userId);

  if (!user) {
    return false;
  }

  return user.roles.some((r: { role: string }) => roles.includes(r.role));
}

/**
 * Check if user has all of the specified roles
 */
export async function hasAllRoles(userId: string, roles: string[]): Promise<boolean> {
  const user = await usersDAL.getUserById(userId);

  if (!user) {
    return false;
  }

  const userRoles = user.roles.map((r: { role: string }) => r.role);
  return roles.every((role) => userRoles.includes(role));
}

/**
 * Get user roles
 */
export async function getUserRoles(userId: string): Promise<string[]> {
  const roles = await usersDAL.getUserRoles(userId);
  return roles.map((r: { role: string }) => r.role);
}

// ========================================
// Statistics
// ========================================

/**
 * Get user statistics
 * Note: This is a placeholder - actual stats would come from other modules (listings, deliveries, etc.)
 */
export async function getUserStats(_userId: string) {
  // TODO: Implement actual stats from other modules
  // For now, return mock data structure
  return {
    totalListings: 0,
    totalPurchases: 0,
    totalSales: 0,
    totalDeliveries: 0,
    averageRating: 0,
    totalReviews: 0,
    co2Saved: 0,
  };
}

/**
 * Get user profile with stats
 */
export async function getProfileWithStats(userId: string) {
  const [user, stats] = await Promise.all([
    getProfile(userId),
    getUserStats(userId),
  ]);

  return {
    user,
    stats,
  };
}
