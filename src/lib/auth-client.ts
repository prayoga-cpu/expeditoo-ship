"use client";

import { createAuthClient } from "better-auth/react";
import { customSessionClient } from "better-auth/client/plugins";
import type { auth, Session, User } from "./auth";

export const authClient = createAuthClient({
  // In the browser, always talk to the origin that served the page.
  //
  // `NEXT_PUBLIC_APP_URL` is inlined into the client bundle at build time and
  // names the production deployment, so `pnpm dev` gave you a page on
  // localhost:3000 POSTing sign-in to expeditoo-rho.vercel.app. That is
  // cross-origin, the deployment sends no CORS headers, and the browser
  // reports a bare "Failed to fetch" with nothing in the local server log —
  // because the request never reached this server at all.
  //
  // Same-origin is also the only correct answer in production: the session
  // cookie is scoped to the origin serving the app, so pointing the client
  // elsewhere would authenticate against a session it cannot then read. The
  // env var remains the server-side fallback, where there is no `window`.
  baseURL:
    typeof window === "undefined"
      ? process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
      : window.location.origin,
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
