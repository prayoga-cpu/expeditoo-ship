"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useSession } from "@/lib/auth-client";
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
    // better-auth's client session type omits the additionalFields declared
    // in src/lib/auth.ts (isVerified, banned, stripe*), even though the runtime
    // payload carries them. The cast bridges that gap in one place.
    user: (data?.user as User | undefined) ?? null,
    isAuthenticated: !!data,
    isLoading: isPending,
  };

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
