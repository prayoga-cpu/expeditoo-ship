import { z } from "zod";
import { userRoleEnum } from "@/db/schema/users";

/**
 * Derived from the database enum, never restated.
 *
 * A restated copy drifts. `user.dto.ts` carried one listing the v1 roles and it
 * silently broke every admin role assignment; this file had the right values
 * but the same fragility. Deriving means the two cannot disagree.
 */
export const UserRoleSchema = z.enum(userRoleEnum.enumValues);

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
