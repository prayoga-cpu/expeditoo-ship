"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { useQueryClient } from "@tanstack/react-query";
import { composeName } from "@/lib/person-name";
import {
  authErrorKey,
  thrownAuthErrorKey,
  type AuthErrorKey,
} from "@/features/auth/lib/auth-errors";

/** Better Auth's code for a sign-in refused because the address is unconfirmed. */
const EMAIL_NOT_VERIFIED = "EMAIL_NOT_VERIFIED";

/**
 * What every action answers. `error` is a key, never a sentence: the server's
 * own wording is English and stops here (`auth-errors.ts`).
 */
export type AuthActionResult = { success: boolean; error?: AuthErrorKey };

/** `/verify-email`, carrying the address its resend button needs. */
export function verifyEmailPath(email: string, from?: "signin"): string {
  const query = new URLSearchParams({ email: email.trim() });
  if (from) query.set("from", from);
  return `/verify-email?${query.toString()}`;
}

/**
 * Hook for authentication actions (signin, signup, signout, etc.)
 * Uses better-auth client under the hood
 */
export function useAuthActions() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<AuthErrorKey | null>(null);

  const refuse = (key: AuthErrorKey): AuthActionResult => {
    setError(key);
    return { success: false, error: key };
  };

  /**
   * The frame every action shares: the loading flag, a clean slate, and a
   * request that threw (offline, blocked) turned into a key like any other
   * refusal.
   */
  const run = async (
    action: () => Promise<AuthActionResult>
  ): Promise<AuthActionResult> => {
    setIsLoading(true);
    setError(null);

    try {
      return await action();
    } catch (err) {
      return refuse(thrownAuthErrorKey(err));
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Sign in with email and password
   */
  const signIn = (email: string, password: string, rememberMe = false) =>
    run(async () => {
      const result = await authClient.signIn.email({
        email,
        password,
        rememberMe,
      });

      if (result.error) {
        // An unconfirmed address is not an error to print: Better Auth has
        // just mailed a fresh link (`sendOnSignIn`), and the verify screen is
        // where the resend button lives if that one does not arrive either.
        if (result.error.code === EMAIL_NOT_VERIFIED) {
          router.push(verifyEmailPath(email, "signin"));
          return { success: false };
        }

        return refuse(authErrorKey(result.error));
      }

      // Redirect to home after successful signin
      router.push("/home");
      router.refresh();

      return { success: true };
    });

  /**
   * Sign up with email and password
   */
  const signUp = (
    email: string,
    password: string,
    person: { firstName: string; lastName: string; alias?: string }
  ) =>
    run(async () => {
      // `name` is the display string; the server re-composes it from the
      // parts in the user-create hook (client_feedback_2026_10_spec.md §1).
      const firstName = person.firstName.trim();
      const lastName = person.lastName.trim();
      const alias = person.alias?.trim();
      const result = await authClient.signUp.email({
        email,
        password,
        name: composeName(firstName, lastName),
        firstName,
        lastName,
        ...(alias ? { alias } : {}),
      });

      if (result.error) return refuse(authErrorKey(result.error));

      // The account exists from here on, whether or not its first mail left
      // (the server never fails a sign-up on the mail). The verify screen is
      // told the address so its resend button works without asking for it.
      router.push(verifyEmailPath(email));

      return { success: true };
    });

  /**
   * Sign in with Google OAuth
   */
  const signInWithGoogle = () =>
    run(async () => {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: "/home",
        // A brand-new account (this provider's first sign-in) lands on
        // onboarding instead — see /welcome. An existing account signing in
        // again always takes callbackURL above.
        newUserCallbackURL: "/welcome",
      });

      // The redirect to Google never started (provider not configured, rate
      // limit). This used to be dropped: the button simply did nothing.
      if (result?.error) return refuse(authErrorKey(result.error));

      return { success: true };
    });

  /**
   * Sign out
   */
  const signOut = () =>
    run(async () => {
      await authClient.signOut();

      // Clear all react-query cache to prevent stale data (like user roles)
      // persisting to the next session
      queryClient.clear();

      // Redirect to signin page
      router.push("/signin");
      router.refresh();

      return { success: true };
    });

  /**
   * Request password reset
   */
  const requestPasswordReset = (email: string) =>
    run(async () => {
      const result = await authClient.requestPasswordReset({
        email,
        redirectTo: "/reset-password",
      });

      if (result.error) return refuse(authErrorKey(result.error));

      return { success: true };
    });

  /**
   * Reset password with token
   */
  const resetPassword = (token: string, newPassword: string) =>
    run(async () => {
      const result = await authClient.resetPassword({
        newPassword,
        token,
      });

      if (result.error) return refuse(authErrorKey(result.error));

      // Redirect to signin
      router.push("/signin");

      return { success: true };
    });

  /**
   * Verify email with token
   */
  const verifyEmail = (token: string) =>
    run(async () => {
      const result = await authClient.verifyEmail({
        query: {
          token,
        },
      });

      if (result.error) return refuse(authErrorKey(result.error));

      // Don't redirect here - let the calling page handle the redirect
      // Better Auth will auto-sign in if autoSignInAfterVerification is enabled

      return { success: true };
    });

  /**
   * Clear error
   */
  const clearError = () => {
    setError(null);
  };

  return {
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    requestPasswordReset,
    resetPassword,
    verifyEmail,
    isLoading,
    error,
    clearError,
  };
}
