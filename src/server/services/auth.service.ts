import { sql } from "drizzle-orm";

import { db } from "@/db";
import * as usersDAL from "@/server/dal/users.dal";
import * as sessionsDAL from "@/server/dal/sessions.dal";
import { sendViaResend, EMAIL_FROM } from "@/lib/email";
import { expedionOrigins, type AppOrigin } from "@/lib/app-origins";

import { VerificationEmail } from "@/server/emails/VerificationEmail";
import { PasswordResetEmail } from "@/server/emails/PasswordResetEmail";

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

    // Whether this address is verified is read back off the row Better Auth
    // has just inserted rather than assumed, because the two signup paths
    // disagree. Under `requireEmailVerification` an email/password signup is
    // unverified at this point and claims nothing -- its quotes are picked up
    // by the session hook the first time the person actually signs in, which
    // they cannot do until they have clicked the link, so nothing is lost by
    // waiting. A Google signup arrives already verified, because Google
    // vouched for the address, and so collects its history immediately.
    const created = await usersDAL.getUserById(userId);
    await claimExpedionQuotesForUser(
      userId,
      email,
      created?.emailVerified ?? false
    );

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
 * Attaches historical Expedion quotes to the account that owns their address.
 *
 * The Airtable import brought 4,591 historical quotes across, but 4,450 carried
 * no UID column, so they are keyed `airtable:<recordId>` and no signed-in
 * client can see them. The rest are keyed by a raw Firebase UID, which is just
 * as invisible to anyone who now signs in through Better Auth instead of
 * Firebase: the id in their session is not the id on the row. Email is the only
 * identifier the systems share. Matching once at import time reached only the
 * handful of clients who already had an account; doing it here means each
 * historical client picks up their own history the moment they can prove the
 * address is theirs, rather than it staying invisible or needing a periodic
 * sweep.
 *
 * Two rules keep that from becoming a way to read a stranger's history:
 *
 * 1. The address must be verified. An unverified address is a claim and not
 *    proof -- anyone can type someone else's address into a signup form -- so
 *    matching on it would hand over that person's quotes to whoever asked
 *    first. The same reasoning already gates the Firebase-to-Better-Auth role
 *    lookup in src/lib/expedion-auth.ts and the support chat's account lookup
 *    in src/app/api/expedion/support/route.ts, and this stays consistent with
 *    them.
 *
 * 2. A row whose `firebase_uid` is already a Better Auth user id belongs to a
 *    live account and is never touched, whatever address it carries. Only rows
 *    still keyed by something the auth layer cannot resolve -- an `airtable:`
 *    key, or a Firebase UID from before the migration -- are ever claimable.
 *    Expressed as a NOT EXISTS against the user table rather than a `not like
 *    'airtable:%'` pattern, because the shape of a legacy Firebase UID is not
 *    something to bet ownership on.
 *
 * That second rule is also what makes this idempotent, which now matters: it
 * runs on every session creation and no longer only once at signup. The first
 * run sets `firebase_uid` to a Better Auth user id, so every run after it sees
 * a row that fails the NOT EXISTS guard, claims nothing, and writes nothing.
 *
 * Failures are logged, swallowed, and reported as zero rows claimed: picking up
 * old quotes is a nicety and must never be able to fail a signup or block a
 * sign-in.
 *
 * @returns how many quotes changed hands, which is 0 on every run but the first
 */
export async function claimExpedionQuotesForUser(
  userId: string,
  email: string,
  emailVerified: boolean
): Promise<number> {
  if (!emailVerified) return 0;

  const address = email?.trim().toLowerCase();
  if (!address) return 0;

  try {
    const claimed = await db.execute(sql`
      update expedion_quotes
      set firebase_uid = ${userId}, user_id = ${userId}
      where email is not null
        and lower(trim(email)) = ${address}
        and not exists (
          select 1 from "user" where "user".id = expedion_quotes.firebase_uid
        )
      returning id
    `);
    const count = Array.from(claimed).length;
    if (count > 0) {
      console.log(
        `[Auth Service] claimed ${count} Expedion quote(s) for ${userId}`
      );

      // Deliberately does NOT set `user.origin = 'expedion'`.
      //
      // Claiming a quote looks like evidence of an Expedion client and is not:
      // this runs for every account on this instance, from either product, and
      // matches on email alone. A carrier who signs up here and whose address
      // happens to appear on a historical Airtable quote would be relabelled an
      // Expedion client by EXPEDITOO's own auth hooks. That is exactly what
      // happened to the one account an earlier backfill marked -- an admin of
      // this app.
    }
    return count;
  } catch (error) {
    console.error("[Auth Service] Expedion quote claim failed:", error);
    return 0;
  }
}

// ========================================
// Transactional Mail Branding
// ========================================

/** Where Expedion's sign-in screen lives in its Flutter router. */
const EXPEDION_SIGNIN_PATH = "/seConnecter";

type MailBranding = {
  /** The product name to print, as this recipient knows it. */
  productName: string;
  /**
   * Where a finished email verification should land the user. Relative keeps
   * them on this app; absolute sends them to the other product.
   */
  verifiedCallbackUrl: string;
};

/**
 * Which product a transactional mail should speak for.
 *
 * EXPEDITOO and Expedion share this Better Auth instance, one `user` table and
 * one password, so a single verification or reset mail template serves both a
 * driver on this app and an auction buyer on the Expedion app. `user.origin`
 * is the only thing that tells them apart -- it is stamped at signup from the
 * request's Origin, see src/lib/app-origins.ts -- and ignoring it is what sent
 * Expedion clients a mail branded for a freight marketplace they have never
 * heard of, with a link into a driver-facing dashboard they cannot use.
 *
 * The Expedion app's base URL is the first entry of EXPEDION_APP_ORIGINS, the
 * same variable proxy.ts uses for CORS and auth.ts for trusted origins, so the
 * address we send people to can never drift from an origin the auth layer
 * already trusts -- and Better Auth origin-checks the callbackURL it is handed,
 * so an untrusted one would be rejected rather than followed. First rather than
 * any: the list is plural so that several deployment previews can all be
 * trusted at once, and the canonical app is the one written first.
 *
 * When EXPEDION_APP_ORIGINS is unset -- a local checkout, or a deployment that
 * has not been told Expedion exists -- there is no Expedion app to send anyone
 * to, so an Expedion account falls back to EXPEDITOO's name and EXPEDITOO's
 * destination. That is exactly what every one of these mails did before this
 * branch existed, which makes the missing variable a cosmetic problem rather
 * than a broken link.
 */
function brandingFor(origin: AppOrigin | null | undefined): MailBranding {
  const expedionApp = origin === "expedion" ? expedionOrigins()[0] : undefined;

  if (!expedionApp) {
    return {
      productName: "EXPEDITOO",
      verifiedCallbackUrl: "/signin?verified=true",
    };
  }

  return {
    productName: "Expedion",
    // Trailing slashes are trimmed because the variable is also read as a CORS
    // origin, where a trailing slash would be wrong, but nothing enforces that
    // and `https://host//seConnecter` is not a route in anyone's router.
    verifiedCallbackUrl: `${expedionApp.replace(/\/+$/, "")}${EXPEDION_SIGNIN_PATH}?verified=true`,
  };
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
  try {
    // Get user name for personalization, and the product this account belongs
    // to -- both come off the same row, so branding costs no extra query.
    const user = await usersDAL.getUserByEmail(email);
    const userName = user?.name?.split(" ")[0] || "there";
    const brand = brandingFor(user?.origin);

    // Use provided URL or fallback to basic URL (for manual resend). The
    // fallback stays on this app for both products: `/verify-email` is a page
    // here, and Expedion's router has no screen at that path to land on.
    let finalVerificationUrl =
      verificationUrl ||
      `${process.env.NEXT_PUBLIC_APP_URL}/verify-email?email=${encodeURIComponent(email)}`;

    // If Better Auth provided a URL, modify the callbackURL to redirect to the
    // sign-in screen of the app this person actually signed up in, carrying the
    // `verified` flag that screen reads. Sending an Expedion buyer to
    // EXPEDITOO's `/signin` ended their verification on a carrier login form
    // for a product they have no account relationship with.
    if (verificationUrl) {
      const url = new URL(finalVerificationUrl);
      url.searchParams.set("callbackURL", brand.verifiedCallbackUrl);
      finalVerificationUrl = url.toString();
    }

    await sendViaResend({
      from: EMAIL_FROM,
      to: email,
      subject: `Verify your ${brand.productName} account`,
      react: VerificationEmail({
        verificationUrl: finalVerificationUrl,
        userName,
        productName: brand.productName,
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
 * asked for (useAuthActions.requestPasswordReset), and rewriting it -- as the
 * verification path does -- would strand the user on a page with no token.
 *
 * That holds for Expedion accounts too, and deliberately so. Only the product
 * name and the subject change for them; the link keeps both its base and its
 * destination on this app. The token endpoint is Better Auth's, mounted here,
 * and the reset *form* is a page here as well -- Expedion's client asks for it
 * by name (ExpeditooAuthClient.requestPasswordReset sends `redirectTo` pointing
 * at this app) because its Flutter router has no reset screen of its own.
 * Rebasing the link onto the Expedion origin would land every Expedion user on
 * that router's not-found page and leave them unable to reset at all.
 *
 * @param email - User's email address
 * @param resetUrl - Reset URL with token (provided by Better Auth)
 */
export async function sendPasswordResetEmail(email: string, resetUrl: string) {
  try {
    // Get user name for personalization, plus the product to brand this as.
    const user = await usersDAL.getUserByEmail(email);
    const userName = user?.name?.split(" ")[0] || "there";
    const brand = brandingFor(user?.origin);

    await sendViaResend({
      from: EMAIL_FROM,
      to: email,
      subject: `Reset your ${brand.productName} password`,
      react: PasswordResetEmail({
        resetUrl,
        userName,
        productName: brand.productName,
      }),
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

/**
 * Stamp the moment a user got in.
 *
 * Called from the session-create hook in src/lib/auth.ts, which is the only
 * place that knows a sign-in just happened.
 */
export async function recordLogin(userId: string, at: Date = new Date()) {
  await usersDAL.updateLastLogin(userId, at);
}

/**
 * Refuse a session for a suspended account.
 *
 * `reject` is handed in rather than thrown from here because the caller is
 * Better Auth's session hook, and only it can raise the APIError shape the
 * auth layer turns into a 403 the client understands.
 */
export async function rejectIfBanned(
  userId: string,
  reject: (message: string) => never
) {
  const user = await usersDAL.getUserById(userId);

  if (user?.banned) {
    reject(
      "This account has been suspended. Contact support if you believe this is a mistake."
    );
  }
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
