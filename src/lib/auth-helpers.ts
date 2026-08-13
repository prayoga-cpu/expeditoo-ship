import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import * as usersDAL from "@/server/dal/users.dal";
import type { AuthSession } from "@/lib/auth";

// ========================================
// Server-Side Auth Helpers
// For use in Server Components and Server Actions
// ========================================

/**
 * Get current session from headers
 * Returns null if not authenticated
 */
export async function getServerSession(): Promise<AuthSession | null> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    return session;
  } catch (error) {
    console.error("[Auth Helpers] Error getting session:", error);
    return null;
  }
}

/**
 * Require authentication
 * Redirects to /signin if not authenticated
 * Use in Server Components
 */
export async function requireAuth(): Promise<AuthSession> {
  const session = await getServerSession();

  if (!session) {
    redirect("/signin");
  }

  return session;
}

/**
 * Require specific role
 * Redirects to /home if user doesn't have the role
 * Use in Server Components
 */
export async function requireRole(role: string): Promise<AuthSession> {
  const session = await requireAuth();

  const hasRole = await checkUserHasRole(session.user.id, role);

  if (!hasRole) {
    redirect("/home");
  }

  return session;
}

/**
 * Require admin role
 * Shorthand for requireRole("admin")
 */
export async function requireAdmin(): Promise<AuthSession> {
  return requireRole("admin");
}

/**
 * Require multiple roles (user must have ALL of them)
 */
export async function requireAllRoles(roles: string[]): Promise<AuthSession> {
  const session = await requireAuth();

  const user = await usersDAL.getUserById(session.user.id);

  if (!user) {
    redirect("/signin");
  }

  const userRoles = user.roles.map((r: { role: string }) => r.role);
  const hasAllRoles = roles.every((role) => userRoles.includes(role));

  if (!hasAllRoles) {
    redirect("/home");
  }

  return session;
}

/**
 * Require at least one of the specified roles
 */
export async function requireAnyRole(roles: string[]): Promise<AuthSession> {
  const session = await requireAuth();

  const user = await usersDAL.getUserById(session.user.id);

  if (!user) {
    redirect("/signin");
  }

  const userRoles = user.roles.map((r: { role: string }) => r.role);
  const hasAnyRole = roles.some((role) => userRoles.includes(role));

  if (!hasAnyRole) {
    redirect("/home");
  }

  return session;
}

// ========================================
// Non-Redirecting Checks
// Return boolean instead of redirecting
// ========================================

/**
 * Check if user is authenticated
 * Returns boolean, does not redirect
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getServerSession();
  return !!session;
}

/**
 * Check if user has specific role
 * Returns boolean, does not redirect
 */
export async function hasRole(role: string): Promise<boolean> {
  const session = await getServerSession();

  if (!session) {
    return false;
  }

  return checkUserHasRole(session.user.id, role);
}

/**
 * Check if user has any of the specified roles
 * Returns boolean, does not redirect
 */
export async function hasAnyRole(roles: string[]): Promise<boolean> {
  const session = await getServerSession();

  if (!session) {
    return false;
  }

  const user = await usersDAL.getUserById(session.user.id);

  if (!user) {
    return false;
  }

  const userRoles = user.roles.map((r: { role: string }) => r.role);
  return roles.some((role) => userRoles.includes(role));
}

/**
 * Check if user has all of the specified roles
 * Returns boolean, does not redirect
 */
export async function hasAllRoles(roles: string[]): Promise<boolean> {
  const session = await getServerSession();

  if (!session) {
    return false;
  }

  const user = await usersDAL.getUserById(session.user.id);

  if (!user) {
    return false;
  }

  const userRoles = user.roles.map((r: { role: string }) => r.role);
  return roles.every((role) => userRoles.includes(role));
}

/**
 * Check if current user is admin
 * Returns boolean, does not redirect
 */
export async function isAdmin(): Promise<boolean> {
  return hasRole("admin");
}

// ========================================
// Internal Helper Functions
// ========================================

/**
 * Check if user has role (internal helper)
 */
async function checkUserHasRole(userId: string, role: string): Promise<boolean> {
  try {
    return await usersDAL.userHasRole(userId, role);
  } catch (error) {
    console.error("[Auth Helpers] Error checking role:", error);
    return false;
  }
}

// ========================================
// User Data Helpers
// ========================================

/**
 * Get current user with roles
 * Returns null if not authenticated
 */
export async function getCurrentUser() {
  const session = await getServerSession();

  if (!session) {
    return null;
  }

  return usersDAL.getUserById(session.user.id);
}

/**
 * Get current user ID
 * Returns null if not authenticated
 */
export async function getCurrentUserId(): Promise<string | null> {
  const session = await getServerSession();
  return session?.user.id ?? null;
}

/**
 * Get current user roles
 * Returns empty array if not authenticated
 */
export async function getCurrentUserRoles(): Promise<string[]> {
  const session = await getServerSession();

  if (!session) {
    return [];
  }

  const roles = await usersDAL.getUserRoles(session.user.id);
  return roles.map((r: { role: string }) => r.role);
}
