import { betterAuth, type BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer, customSession } from "better-auth/plugins";
import { db } from "@/db";
import * as schema from "@/db/schema";
import {
  handlePostSignup,
  sendVerificationEmail,
} from "@/server/services/auth.service";
import { getUserRoles } from "@/server/services/user.service";
import type {
  EmailVerificationParams,
  PasswordResetParams,
  EmailCallbackRequest,
} from "@/types/auth.types";

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
      await sendVerificationEmail(user.email, url);
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
  },

  // Session Configuration
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // Refresh if session is older than 1 day
    cookieCache: {
      enabled: true,
      maxAge: 60 * 60 * 24 * 7, // 7 days
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
  baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",

  // Trusted Origins
  //
  // Expedion's Flutter client is a separate origin, so it has to be listed
  // here or Better Auth rejects its sign-in POSTs as cross-origin. Configured
  // rather than hard-coded because the web build moves between a Vercel
  // preview, the production domain and localhost during development; the
  // native builds send no Origin header at all and are unaffected either way.
  trustedOrigins: [
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    ...(process.env.EXPEDION_APP_ORIGINS?.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean) ?? []),
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
      return { user: { ...user, roles }, session };
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
