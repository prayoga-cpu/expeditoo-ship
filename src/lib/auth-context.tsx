"use client";

import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useSession } from "@/lib/auth-client";
import { markReturningVisitor } from "@/lib/returning-visitor";
import type { Session, User } from "@/lib/auth";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Use better-auth's useSession hook
  const { data, isPending } = useSession();

  const authValue: AuthContextType = {
    session: data?.session ?? null,
    // The server's customSession plugin shapes the payload ({ user, session }
    // with user.roles and the additionalFields), and customSessionClient in
    // auth-client.ts mirrors it. The cast aligns the client and server views
    // of that shape in one place.
    user: (data?.user as User | undefined) ?? null,
    isAuthenticated: !!data,
    isLoading: isPending,
  };

  // Remembering that this device has had a session is what lets the landing
  // page send a signed-out visitor to login rather than signup. Marked here
  // rather than on the landing page so it holds however the session started.
  useEffect(() => {
    if (authValue.isAuthenticated) markReturningVisitor();
  }, [authValue.isAuthenticated]);

  return (
    <AuthContext.Provider value={authValue}>{children}</AuthContext.Provider>
  );
}

/** What the server renders with: it never knows the session. */
const SERVER_VIEW: AuthContextType = {
  session: null,
  user: null,
  isAuthenticated: false,
  isLoading: true,
};

const subscribeNothing = () => () => {};

/**
 * The session, as this component may show it right now (2.96.0 #36).
 *
 * Pages render on the server since 2.96.0, without a session. The session is
 * an external store (Better Auth's, through `useSyncExternalStore`), so when
 * it arrives while part of the page is still waiting to hydrate — a segment
 * whose code is still loading, a Suspense boundary React has not reached —
 * that part hydrated with the session already in it, did not match the
 * server's HTML, and React threw it away and rendered it again: the same
 * remount, and the same lost tap, the fix was for. A component hydrates with
 * what the server had and re-renders with the session straight after; once
 * the page is hydrated this is the session itself.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  const hydrated = useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false
  );
  return hydrated ? context : SERVER_VIEW;
}
