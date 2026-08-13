"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Hook for authentication actions (signin, signup, signout, etc.)
 * Uses better-auth client under the hood
 */
export function useAuthActions() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Sign in with email and password
   */
  const signIn = async (
    email: string,
    password: string,
    rememberMe = false
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await authClient.signIn.email({
        email,
        password,
        rememberMe,
      });

      if (result.error) {
        setError(result.error.message || "Sign in failed");
        return { success: false, error: result.error.message };
      }

      // Redirect to home after successful signin
      router.push("/home");
      router.refresh();

      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Sign in failed";
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Sign up with email and password
   */
  const signUp = async (email: string, password: string, name: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await authClient.signUp.email({
        email,
        password,
        name,
      });

      if (result.error) {
        setError(result.error.message || "Sign up failed");
        return { success: false, error: result.error.message };
      }

      // Redirect to verification page
      router.push("/verify-email");

      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Sign up failed";
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Sign in with Google OAuth
   */
  const signInWithGoogle = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: "/home",
      });

      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Google sign in failed";
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Sign out
   */
  const signOut = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await authClient.signOut();

      // Clear all react-query cache to prevent stale data (like user roles)
      // persisting to the next session
      queryClient.clear();

      // Redirect to signin page
      router.push("/signin");
      router.refresh();

      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Sign out failed";
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Request password reset
   */
  const requestPasswordReset = async (email: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await authClient.requestPasswordReset({
        email,
        redirectTo: "/reset-password",
      });

      if (result.error) {
        setError(result.error.message || "Failed to send reset email");
        return { success: false, error: result.error.message };
      }

      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to send reset email";
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Reset password with token
   */
  const resetPassword = async (token: string, newPassword: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await authClient.resetPassword({
        newPassword,
        token,
      });

      if (result.error) {
        setError(result.error.message || "Failed to reset password");
        return { success: false, error: result.error.message };
      }

      // Redirect to signin
      router.push("/signin");

      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to reset password";
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Verify email with token
   */
  const verifyEmail = async (token: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await authClient.verifyEmail({
        query: {
          token,
        },
      });

      if (result.error) {
        setError(result.error.message || "Email verification failed");
        return { success: false, error: result.error.message };
      }

      // Don't redirect here - let the calling page handle the redirect
      // Better Auth will auto-sign in if autoSignInAfterVerification is enabled

      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Email verification failed";
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

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
