import { z } from "zod";

/**
 * User roles enum matching database schema
 */
export const UserRoleSchema = z.enum([
  "shipper",
  "carrier",
  "driver",
  "operator",
  "support",
  "finance",
  "admin",
]);

/**
 * Response schema for user roles API
 */
export const UserRolesResponseSchema = z.object({
  roles: z.array(UserRoleSchema),
});

/**
 * Type exports
 */
export type UserRole = z.infer<typeof UserRoleSchema>;
export type UserRolesResponse = z.infer<typeof UserRolesResponseSchema>;
