import { Resend } from "resend";
import { sql } from "drizzle-orm";

import { db } from "@/db";
import * as usersDAL from "@/server/dal/users.dal";
import * as sessionsDAL from "@/server/dal/sessions.dal";

import { VerificationEmail } from "@/server/emails/VerificationEmail";
import { PasswordResetEmail } from "@/server/emails/PasswordResetEmail";

// Initialize Resend for email sending
const resend = new Resend(process.env.RESEND_API_KEY);

// ========================================
// Sign Up Service
// ========================================

/**
 * Handle post-signup business logic
 * Note: better-auth handles the actual user creation and email sending
 * This service handles additional business logic like role assignment
 */
export async function handlePostSignup(userId: string, email: string) {
  try {
    // Assign default "buyer" role to new user
    await usersDAL.assignDefaultRole(userId);

    await claimImportedExpedionQuotes(userId, email);

    return {
      success: true,
      message:
        "Account created successfully. Please check your email to verify your account.",
    };
  } catch (error) {
    console.error("[Auth Service] Post-signup error:", error);
    throw error;
  }
}

/**
 * Attaches Airtable-imported Expedion quotes to a newly created account.
 *
 * The import brought 4,591 historical quotes across, but 4,450 carried no UID
 * column, so they are keyed `airtable:<recordId>` and no signed-in client can
 * see them. Email is the only identifier the two systems share. Matching once
 * at import time reached only the handful of clients who already had an
 * account; doing it again here means each historical client picks up their own
 * history the first time they sign up, rather than it staying invisible or
 * needing a periodic sweep.
 *
 * Scoped to rows still bearing the `airtable:` key, so it can never move a
 * quote that already belongs to someone. Failures are logged and swallowed:
 * claiming old quotes is a nicety and must not be able to fail a signup.
 */
async function claimImportedExpedionQuotes(userId: string, email: string) {
  const address = email?.trim().toLowerCase();
  if (!address) return;

  try {
    const claimed = await db.execute(sql`
      update expedion_quotes
      set firebase_uid = ${userId}, user_id = ${userId}
      where firebase_uid like 'airtable:%'
        and email is not null
        and lower(trim(email)) = ${address}
      returning id
    `);
    const count = Array.from(claimed).length;
    if (count > 0) {
      console.log(
        `[Auth Service] claimed ${count} imported Expedion quote(s) for ${userId}`
      );
    }
  } catch (error) {
    console.error("[Auth Service] Expedion quote claim failed:", error);
  }
}

// ========================================
// Email Verification
// ========================================

/**
 * Send verification email to user
 * @param email - User's email address
 * @param verificationUrl - Verification URL with token (provided by Better Auth)
 */
export async function sendVerificationEmail(
  email: string,
  verificationUrl?: string
) {
  // Use provided URL or fallback to basic URL (for manual resend)
  let finalVerificationUrl =
    verificationUrl ||
    `${process.env.NEXT_PUBLIC_APP_URL}/verify-email?email=${encodeURIComponent(email)}`;

  // If Better Auth provided a URL, modify the callbackURL to redirect to signin with verified param
  if (verificationUrl) {
    const url = new URL(finalVerificationUrl);
    url.searchParams.set("callbackURL", "/signin?verified=true");
    finalVerificationUrl = url.toString();
  }

  try {
    // Get user name for personalization
    const user = await usersDAL.getUserByEmail(email);
    const userName = user?.name?.split(" ")[0] || "there";

    // Determine recipient based on environment
    // In development, send all emails to test email
    // In production, send to actual user email
    const isDevelopment = process.env.NODE_ENV !== "production";
    const recipientEmail = isDevelopment
      ? "prayogadevelopment@gmail.com"
      : email;

    await resend.emails.send({
      from: process.env.EMAIL_FROM || "EXPEDITOO <onboarding@resend.dev>",
      to: recipientEmail,
      subject: "Verify your EXPEDITOO account",
      react: VerificationEmail({
        verificationUrl: finalVerificationUrl,
        userName,
      }),
    });
  } catch (error) {
    console.error("[Auth Service] Failed to send verification email:", error);
    // Don't throw - email failure shouldn't block account creation
    // But log for admin notification
  }
}

/**
 * Resend verification email
 */
export async function resendVerificationEmail(email: string) {
  // Check if user exists
  const user = await usersDAL.getUserByEmail(email);

  if (!user) {
    // Don't reveal if email exists (security)
    return {
      success: true,
      message:
        "If an account exists with this email, a verification link has been sent.",
    };
  }

  // Check if already verified
  if (user.emailVerified) {
    return {
      success: false,
      message: "This email address is already verified.",
    };
  }

  // Send verification email
  await sendVerificationEmail(email);

  return {
    success: true,
    message: "Verification email sent. Please check your inbox.",
  };
}

// ========================================
// Password Reset
// ========================================

/**
 * Send password reset email.
 *
 * `resetUrl` is Better Auth's own reset link and is sent verbatim: its
 * `callbackURL` already carries the `/reset-password` destination the client
 * asked for (useAuthActions.requestPasswordReset), and rewriting it — as the
 * verification path does — would strand the user on a page with no token.
 *
 * @param email - User's email address
 * @param resetUrl - Reset URL with token (provided by Better Auth)
 */
export async function sendPasswordResetEmail(email: string, resetUrl: string) {
  try {
    // Get user name for personalization
    const user = await usersDAL.getUserByEmail(email);
    const userName = user?.name?.split(" ")[0] || "there";

    // Determine recipient based on environment
    const isDevelopment = process.env.NODE_ENV !== "production";
    const recipientEmail = isDevelopment
      ? "prayogadevelopment@gmail.com"
      : email;

    await resend.emails.send({
      from: process.env.EMAIL_FROM || "EXPEDITOO <delivered@resend.dev>",
      to: recipientEmail,
      subject: "Reset your EXPEDITOO password",
      react: PasswordResetEmail({ resetUrl, userName }),
    });
  } catch (error) {
    console.error("[Auth Service] Failed to send password reset email:", error);
    // Don't throw - a mail failure must not surface whether the account exists
  }
}

// ========================================
// Session Management
// ========================================

/**
 * Invalidate all sessions for user (e.g., after password reset)
 */
export async function invalidateAllUserSessions(userId: string) {
  await sessionsDAL.deleteUserSessions(userId);
}

// ========================================
// Account Security
// ========================================

/**
 * Check if account is locked (after failed login attempts)
 * Note: This is a placeholder - better-auth may handle this
 */
export async function isAccountLocked(_email: string): Promise<boolean> {
  // TODO: Implement rate limiting / account locking logic
  // For now, return false
  return false;
}

/**
 * Lock account (after too many failed attempts)
 */
export async function lockAccount(_email: string) {
  // TODO: Implement account locking
}

/**
 * Unlock account
 */
export async function unlockAccount(_email: string) {
  // TODO: Implement account unlocking
}

// ========================================
// Cleanup & Maintenance
// ========================================

/**
 * Cleanup expired sessions (to be run by cron job)
 */
export async function cleanupExpiredSessions() {
  const deleted = await sessionsDAL.cleanupExpiredSessions();
  return deleted;
}
