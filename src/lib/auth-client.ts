"use client";

import { createAuthClient } from "better-auth/react";
import { customSessionClient } from "better-auth/client/plugins";
import type { auth, Session, User } from "./auth";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  // Type-level mirror of the server's `customSession` plugin, so the data
  // returned by `useSession()` carries `user.roles` (see src/lib/auth.ts).
  plugins: [customSessionClient<typeof auth>()],
});

// Export commonly used methods for convenience
export const {
  signIn,
  signUp,
  signOut,
  useSession,
  $Infer,
} = authClient;

// Re-export types
export type { Session, User };
