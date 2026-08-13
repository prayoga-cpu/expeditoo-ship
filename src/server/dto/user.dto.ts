import { z } from "zod";

// ========================================
// User Role Enum
// ========================================

export const userRoleSchema = z.enum([
  "buyer",
  "seller",
  "auctioneer",
  "transporter",
  "operator",
  "admin",
]);

export type UserRole = z.infer<typeof userRoleSchema>;

// ========================================
// User Output (Profile)
// ========================================

export const userOutputSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  image: z.string().nullable(),
  emailVerified: z.boolean(),
  isVerified: z.boolean(),
  roles: z.array(userRoleSchema),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type UserOutput = z.infer<typeof userOutputSchema>;

// ========================================
// User List Output (For Admin)
// ========================================

export const userListItemSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  image: z.string().nullable(),
  emailVerified: z.boolean(),
  isVerified: z.boolean(),
  banned: z.boolean(),
  roles: z.array(userRoleSchema),
  createdAt: z.date(),
});

export type UserListItem = z.infer<typeof userListItemSchema>;

export const userListOutputSchema = z.object({
  users: z.array(userListItemSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
  totalPages: z.number(),
});

export type UserListOutput = z.infer<typeof userListOutputSchema>;

// ========================================
// Update Profile
// ========================================

export const updateProfileInputSchema = z.object({
  name: z.string().min(1, "Name must not be empty").trim().optional(),
  image: z.string().url("Invalid image URL").nullable().optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileInputSchema>;

export const updateProfileOutputSchema = z.object({
  success: z.boolean(),
  user: userOutputSchema.optional(),
  message: z.string().optional(),
});

export type UpdateProfileOutput = z.infer<typeof updateProfileOutputSchema>;

// ========================================
// Assign Role (Admin Only)
// ========================================

export const assignRoleInputSchema = z.object({
  userId: z.string().min(1, "Invalid user ID"),
  role: userRoleSchema,
  replace: z.boolean().optional(),
});

export type AssignRoleInput = z.infer<typeof assignRoleInputSchema>;

export const assignRoleOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export type AssignRoleOutput = z.infer<typeof assignRoleOutputSchema>;

// ========================================
// Remove Role (Admin Only)
// ========================================

export const removeRoleInputSchema = z.object({
  userId: z.string().min(1, "Invalid user ID"),
  role: userRoleSchema,
});

export type RemoveRoleInput = z.infer<typeof removeRoleInputSchema>;

export const removeRoleOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export type RemoveRoleOutput = z.infer<typeof removeRoleOutputSchema>;

// ========================================
// Get User Query Parameters
// ========================================

export const getUserQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  role: userRoleSchema.optional(),
  emailVerified: z.enum(["true", "false"]).optional(),
  sortBy: z.enum(["createdAt", "name", "email"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type GetUserQuery = z.infer<typeof getUserQuerySchema>;

// ========================================
// Delete User (Admin Only)
// ========================================

export const deleteUserInputSchema = z.object({
  userId: z.string().min(1, "Invalid user ID"),
  reason: z.string().min(1, "Deletion reason is required").optional(),
});

export type DeleteUserInput = z.infer<typeof deleteUserInputSchema>;

export const deleteUserOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export type DeleteUserOutput = z.infer<typeof deleteUserOutputSchema>;

// ========================================
// User Statistics (For Profile/Admin)
// ========================================

export const userStatsSchema = z.object({
  totalListings: z.number().int().nonnegative(),
  totalPurchases: z.number().int().nonnegative(),
  totalSales: z.number().int().nonnegative(),
  totalDeliveries: z.number().int().nonnegative(),
  averageRating: z.number().min(0).max(5),
  totalReviews: z.number().int().nonnegative(),
  co2Saved: z.number().nonnegative(),
});

export type UserStats = z.infer<typeof userStatsSchema>;

export const userProfileWithStatsSchema = z.object({
  user: userOutputSchema,
  stats: userStatsSchema,
});

export type UserProfileWithStats = z.infer<typeof userProfileWithStatsSchema>;
