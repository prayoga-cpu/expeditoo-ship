"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
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

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
