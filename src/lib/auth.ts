import { betterAuth, type BetterAuthOptions } from "better-auth";
import { APIError } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer, customSession } from "better-auth/plugins";
import { db } from "@/db";
import * as schema from "@/db/schema";
import {
  handlePostSignup,
  recordLogin,
  rejectIfBanned,
  sendPasswordResetEmail,
  sendVerificationEmail,
} from "@/server/services/auth.service";
import { getUserRoles } from "@/server/services/user.service";
import { impersonation } from "@/lib/auth-impersonation";
import { originOfRequest } from "@/lib/app-origins";
import type {
  EmailVerificationParams,
  PasswordResetParams,
  EmailCallbackRequest,
} from "@/types/auth.types";

/**
 * Hostnames Vercel injects for the running deployment.
 *
 * `VERCEL_PROJECT_PRODUCTION_URL` is the stable production domain;
 * `VERCEL_URL` is the immutable per-deployment URL, which is what a preview
 * build is actually served from. Both are set by the platform, so they track
 * the real domain without anyone maintaining a variable.
 *
 * Empty off-platform, where `NEXT_PUBLIC_APP_URL` is the only answer.
 */
function deploymentOrigins(): string[] {
  return [
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_URL,
  ]
    .filter((host): host is string => Boolean(host))
    .map((host) => `https://${host}`);
}

/** The canonical origin: what emails, Stripe returns and OAuth callbacks use. */
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  deploymentOrigins()[0] ||
  "http://localhost:3000";

// Options live in a separate object (rather than inline in `betterAuth`) so
// they can also be handed to the `customSession` plugin below, which needs
// them to infer the user's additionalFields on its callback argument.
const options = {
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),

  // Email and Password Authentication
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    autoSignIn: false, // Don't auto sign in after signup (need email verification)
    sendResetPassword: async (
      { user, url }: PasswordResetParams,
      _request: EmailCallbackRequest
    ) => {
      // Send password reset email. This callback previously sat under
      // `emailVerification`, where Better Auth never reads it — it belongs
      // here, and `satisfies BetterAuthOptions` now enforces that.
      //
      // Reset has its own mail path: the verification one sends a "verify your
      // account" subject and overwrites `callbackURL` with `/signin`, which
      // would take the user anywhere but the reset form.
      await sendPasswordResetEmail(user.email, url);
    },
  },

  // Email Verification Configuration
  emailVerification: {
    sendVerificationEmail: async (
      { user, url, token }: EmailVerificationParams,
      _request: EmailCallbackRequest
    ) => {
      // Send verification email when user signs up
      // Better Auth provides the verification URL with token
      try {
        console.log("[Better Auth] Sending verification email to:", user.email);
        console.log("[Better Auth] Verification URL:", url);
        console.log("[Better Auth] Token:", token);

        // Send verification email with the URL provided by Better Auth.
        // Role assignment does NOT happen here — it lives in the
        // `databaseHooks.user.create.after` hook so OAuth signups (which
        // never trigger this callback) get their default role too.
        await sendVerificationEmail(user.email, url);
      } catch (error) {
        console.error("[Better Auth] Email verification error:", error);
        throw error; // Re-throw to let Better Auth know there was an issue
      }
    },
  },

  // Social Providers
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      // Better Auth uses /api/auth/callback/google as the callback path
      // Make sure this matches what you configured in Google Cloud Console
    },
  },

  // Post-signup role assignment.
  //
  // Runs exactly once per user creation, for BOTH email/password and Google
  // OAuth signups — the adapter inserts a user row in either path. Failure is
  // logged, never rethrown: a missing role is recoverable via admin tooling,
  // whereas a signup aborted after the user row exists (which previously also
  // killed the verification email) is not.
  databaseHooks: {
    user: {
      create: {
        // Which product this signup came from. The two share this Better Auth
        // instance and this table, so the request's Origin is the only thing
        // that distinguishes them, and it is only knowable here -- afterwards
        // the row looks identical either way.
        before: async (user, ctx) => {
          const origin = originOfRequest(ctx?.headers?.get("origin") ?? null);

          return { data: { ...user, origin } };
        },
        after: async (user) => {
          try {
            await handlePostSignup(user.id, user.email);
          } catch (error) {
            console.error(
              "[Better Auth] Default role assignment failed for user:",
              user.id,
              error
            );
          }
        },
      },
    },
    session: {
      create: {
        // Suspension is enforced here, and only here. `user.banned` was
        // written by the admin panel and read by nothing, so suspending
        // somebody left them signed in and free to sign in again.
        //
        // An impersonation session is exempt: an admin looking at a suspended
        // account is usually looking at it *because* it is suspended.
        before: async (session) => {
          const impersonated = (
            session as { impersonatedBy?: string | null }
          ).impersonatedBy;

          if (impersonated) return;

          await rejectIfBanned(session.userId, (message) => {
            throw new APIError("FORBIDDEN", {
              message,
              code: "BANNED_USER",
            });
          });
        },
        // The only moment that knows a sign-in just happened. `updatedAt`
        // could never answer it -- any write to the user row moves that.
        after: async (session) => {
          const impersonated = (
            session as { impersonatedBy?: string | null }
          ).impersonatedBy;

          if (impersonated) return;

          try {
            await recordLogin(session.userId, session.createdAt);
          } catch (error) {
            console.error(
              "[Better Auth] Failed to stamp last login for user:",
              session.userId,
              error
            );
          }
        },
      },
    },
  },

  // Session Configuration
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // Refresh if session is older than 1 day
    cookieCache: {
      enabled: true,
      // The cached copy is trusted without touching the database until it
      // expires, so this is the window in which a suspension, a revoked
      // session or a role change stays invisible on the browser holding it.
      // At the previous 7 days, none of the admin moderation actions had any
      // effect on a signed-in tester for a week.
      maxAge: 60 * 5, // 5 minutes
    },
  },

  // User Configuration
  user: {
    additionalFields: {
      isVerified: {
        type: "boolean",
        required: false,
        defaultValue: false,
      },
      banned: {
        type: "boolean",
        required: false,
        defaultValue: false,
      },
      // Expose Stripe fields to the client
      stripeAccountId: {
        type: "string",
        required: false,
      },
      stripeAccountStatus: {
        type: "string",
        required: false,
        defaultValue: "pending",
      },
    },
  },

  // Advanced Options
  advanced: {
    // generateId: false, // Removed to allow better-auth to generate IDs (since we use text IDs now)
    //
    // `cookieSameSite` / `crossSubdomainEnabled` were never real Better Auth
    // options (silently ignored at runtime); the same intent is expressed
    // below through the keys the library actually reads.
    defaultCookieAttributes: { sameSite: "lax" },
    useSecureCookies: process.env.NODE_ENV === "production",
    crossSubDomainCookies: { enabled: false },
  },

  // Base URL
  //
  // Drives the OAuth callback, so it must match a redirect URI registered with
  // Google. That makes it a deliberate, human-set value rather than something
  // derived per deployment: Vercel's immutable per-deploy hostname changes on
  // every push and could never be registered.
  baseURL: APP_URL,

  // Trusted Origins
  //
  // Expedion's Flutter client is a separate origin, so it has to be listed
  // here or Better Auth rejects its sign-in POSTs as cross-origin. The native
  // builds send no Origin header at all and are unaffected either way.
  //
  // The deployment's own hostnames are always included, whatever
  // NEXT_PUBLIC_APP_URL says. That variable is hand-maintained, and when the
  // deployment domain changed it kept naming the previous one — production then
  // refused sign-in from its own URL with "Invalid origin", which reads like a
  // code fault rather than a stale environment variable. A deployment should
  // never distrust itself.
  trustedOrigins: [
    ...new Set([
      APP_URL,
      ...deploymentOrigins(),
      ...(process.env.EXPEDION_APP_ORIGINS?.split(",")
        .map((origin) => origin.trim())
        .filter(Boolean) ?? []),
    ]),
  ],
} satisfies BetterAuthOptions;

export const auth = betterAuth({
  ...options,

  // Plugins
  //
  // `bearer` lets a non-browser client authenticate with
  // `Authorization: Bearer <session token>` instead of a cookie. Better Auth
  // returns the token in the `set-auth-token` response header on sign-in, and
  // accepts it on every subsequent request. Flutter has no cookie jar of its
  // own on native targets, so without this the Expedion app could sign in and
  // then immediately be treated as anonymous.
  //
  // This is additive: the browser cookie flow Expeditoo's own Next.js app uses
  // is untouched, and a request carrying no bearer header behaves exactly as
  // it did before.
  //
  // `customSession` is the single mechanism that exposes roles to callers:
  // it decorates every session payload with `user.roles` (read from the
  // user_roles table through the service layer), so both the server
  // (`auth.api.getSession`) and the client (`useSession` via
  // `customSessionClient` in auth-client.ts) see `session.user.roles`.
  plugins: [
    bearer(),
    // "Log in as this user" for admins, with the permission check delegated to
    // user_roles rather than a second role column. See auth-impersonation.ts.
    impersonation(),
    customSession(async ({ user, session }) => {
      let roles: string[] = [];
      try {
        roles = await getUserRoles(user.id);
      } catch (error) {
        // A role lookup failure must not take the whole session down; the
        // UI treats an empty array as "shipper defaults".
        console.error(
          "[Better Auth] Failed to load roles for user:",
          user.id,
          error
        );
      }
      // `impersonatedBy` rides along so the client can tell it is inside a
      // borrowed session and show the banner; it is null for every real one.
      const impersonatedBy =
        (session as { impersonatedBy?: string | null }).impersonatedBy ?? null;

      return {
        user: { ...user, roles },
        session: { ...session, impersonatedBy },
      };
    }, options),
  ],
});

// Export types
export type Session = typeof auth.$Infer.Session.session;

export type User = typeof auth.$Infer.Session.user;

// Combined session type (what getSession actually returns)
export type AuthSession = {
  session: Session;
  user: User;
};
