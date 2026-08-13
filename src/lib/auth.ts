import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";
import * as schema from "@/db/schema";
import {
  handlePostSignup,
  sendVerificationEmail,
} from "@/server/services/auth.service";
import type {
  EmailVerificationParams,
  PasswordResetParams,
  EmailCallbackRequest,
} from "@/types/auth.types";

export const auth = betterAuth({
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

        // Assign default "buyer" role to new user
        await handlePostSignup(user.id, user.email);

        // Send verification email with the URL provided by Better Auth
        await sendVerificationEmail(user.email, url);
      } catch (error) {
        console.error("[Better Auth] Email verification error:", error);
        throw error; // Re-throw to let Better Auth know there was an issue
      }
    },
    sendResetPassword: async (
      { user, url }: PasswordResetParams,
      _request: EmailCallbackRequest
    ) => {
      // Send password reset email
      await sendVerificationEmail(user.email, url);
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
  // Advanced Options
  advanced: {
    // generateId: false, // Removed to allow better-auth to generate IDs (since we use text IDs now)
    cookieSameSite: "lax",
    useSecureCookies: process.env.NODE_ENV === "production",
    crossSubdomainEnabled: false,
  },

  // Base URL
  baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",

  // Trusted Origins
  trustedOrigins: [process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"],
});

// Export types
export type Session = typeof auth.$Infer.Session.session;

export type User = typeof auth.$Infer.Session.user;

// Combined session type (what getSession actually returns)
export type AuthSession = {
  session: Session;
  user: User;
};
