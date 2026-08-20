import { db } from "@/db";
import {
  session,
  type InsertSession,
} from "@/db/schema";
import { eq, lt, gt, and, desc, isNull, sql } from "drizzle-orm";

// ========================================
// Session CRUD Operations
// ========================================

/**
 * Get session by ID
 */
export async function getSessionById(id: string) {
  return db.query.session.findFirst({
    where: eq(session.id, id),
    with: {
      user: {
        with: {
          roles: true,
        },
      },
    },
  });
}

/**
 * Get session by token
 */
export async function getSessionByToken(token: string) {
  return db.query.session.findFirst({
    where: eq(session.token, token),
    with: {
      user: {
        with: {
          roles: true,
        },
      },
    },
  });
}

/**
 * Create new session
 */
export async function createSession(data: InsertSession) {
  const [newSession] = await db
    .insert(session)
    .values(data)
    .returning();

  return newSession;
}

/**
 * Update session expiry
 */
export async function updateSessionExpiry(id: string, expiresAt: Date) {
  const [updatedSession] = await db
    .update(session)
    .set({ expiresAt })
    .where(eq(session.id, id))
    .returning();

  return updatedSession;
}

/**
 * Delete session by ID
 */
export async function deleteSession(id: string) {
  await db.delete(session).where(eq(session.id, id));
}

/**
 * Delete session by token
 */
export async function deleteSessionByToken(token: string) {
  await db.delete(session).where(eq(session.token, token));
}

/**
 * Delete all sessions for a user.
 *
 * Returns how many were killed, which is what the admin "sign out everywhere"
 * action reports back.
 *
 * `keepImpersonated` spares the sessions an admin opened *as* this user. Both
 * admin actions that revoke sessions target the user's own access -- an admin
 * looking at the account is not one of their devices -- and killing that row
 * strands the admin at the sign-in screen, because the session cookie in their
 * browser then names a token that no longer exists.
 */
export async function deleteUserSessions(
  userId: string,
  { keepImpersonated = false }: { keepImpersonated?: boolean } = {}
): Promise<number> {
  const deleted = await db
    .delete(session)
    .where(
      keepImpersonated
        ? and(eq(session.userId, userId), isNull(session.impersonatedBy))
        : eq(session.userId, userId)
    )
    .returning({ id: session.id });

  return deleted.length;
}

/**
 * Delete expired sessions
 */
export async function deleteExpiredSessions() {
  const now = new Date();
  const result = await db
    .delete(session)
    .where(lt(session.expiresAt, now))
    .returning({ id: session.id });

  return result.length;
}

// ========================================
// Session Queries
// ========================================

/**
 * Get all active sessions for a user
 */
export async function getUserSessions(userId: string) {
  const now = new Date();

  return db.query.session.findMany({
    where: and(
      eq(session.userId, userId),
      gt(session.expiresAt, now) // Only active sessions
    ),
    orderBy: desc(session.createdAt),
  });
}

/**
 * Check if session is valid (exists and not expired)
 */
export async function isSessionValid(token: string): Promise<boolean> {
  const now = new Date();

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(session)
    .where(
      and(
        eq(session.token, token),
        gt(session.expiresAt, now)
      )
    );

  return Number(result[0]?.count) > 0;
}

/**
 * Get session count for user
 */
export async function getUserSessionCount(userId: string): Promise<number> {
  const now = new Date();

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(session)
    .where(
      and(
        eq(session.userId, userId),
        gt(session.expiresAt, now)
      )
    );

  return Number(result[0]?.count) || 0;
}

/**
 * Get total active sessions count
 */
export async function getTotalActiveSessions(): Promise<number> {
  const now = new Date();

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(session)
    .where(gt(session.expiresAt, now));

  return Number(result[0]?.count) || 0;
}

// ========================================
// Session Cleanup
// ========================================

/**
 * Delete all sessions older than given date
 */
export async function deleteSessionsOlderThan(date: Date) {
  const result = await db
    .delete(session)
    .where(lt(session.createdAt, date))
    .returning({ id: session.id });

  return result.length;
}

/**
 * Cleanup expired sessions (to be run by cron job)
 */
export async function cleanupExpiredSessions() {
  const deleted = await deleteExpiredSessions();
  console.log(`[Session Cleanup] Deleted ${deleted} expired sessions`);
  return deleted;
}
