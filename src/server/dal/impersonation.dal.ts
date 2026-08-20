import { db } from "@/db";
import { impersonationSessions, session } from "@/db/schema";
import { and, desc, eq, isNull } from "drizzle-orm";
import { nanoid } from "nanoid";

/**
 * The audit trail behind "log in as this user".
 *
 * Permission-blind, like every DAL: the rules about who may impersonate whom
 * live in impersonation.service.ts.
 */

interface StartRecord {
  adminId: string;
  adminEmail: string;
  targetUserId: string;
  targetEmail: string;
  sessionToken: string;
  expiresAt: Date;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function recordStart(record: StartRecord) {
  const [row] = await db
    .insert(impersonationSessions)
    .values({
      id: nanoid(),
      adminId: record.adminId,
      adminEmail: record.adminEmail,
      targetUserId: record.targetUserId,
      targetEmail: record.targetEmail,
      sessionToken: record.sessionToken,
      expiresAt: record.expiresAt,
      ipAddress: record.ipAddress ?? null,
      userAgent: record.userAgent ?? null,
    })
    .returning();

  return row;
}

/**
 * Close the open record for a session token. Returns the row, or undefined
 * when there is none -- a stop must still succeed for a session whose audit
 * row was never written or has already been closed.
 */
export async function recordEnd(sessionToken: string, endedAt = new Date()) {
  const [row] = await db
    .update(impersonationSessions)
    .set({ endedAt })
    .where(
      and(
        eq(impersonationSessions.sessionToken, sessionToken),
        isNull(impersonationSessions.endedAt)
      )
    )
    .returning();

  return row;
}

/** Most recent impersonations, newest first. For the admin audit view. */
export async function listRecent(limit = 50) {
  return db
    .select()
    .from(impersonationSessions)
    .orderBy(desc(impersonationSessions.startedAt))
    .limit(limit);
}

/** Every impersonation session still open against a user. */
export async function getOpenSessionsForTarget(targetUserId: string) {
  return db
    .select()
    .from(impersonationSessions)
    .where(
      and(
        eq(impersonationSessions.targetUserId, targetUserId),
        isNull(impersonationSessions.endedAt)
      )
    );
}

/** The session row Better Auth minted for an impersonation, by its token. */
export async function getSessionByToken(token: string) {
  return db.query.session.findFirst({
    where: eq(session.token, token),
  });
}
