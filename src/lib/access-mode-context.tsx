"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { useAuth } from "@/lib/auth-context";
import {
  type AccessMode,
  getStoredAccessMode,
  qualifiedAccessModes,
  resolveAccessMode,
  setStoredAccessMode,
} from "@/lib/active-access";

interface AccessModeContextType {
  mode: AccessMode;
  qualifiedModes: AccessMode[];
  setMode: (next: AccessMode) => void;
}

const AccessModeContext = createContext<AccessModeContextType | undefined>(
  undefined
);

/**
 * One shared piece of state, not one per reader.
 *
 * `AccessSwitcher`, `MainLayout` and `BottomNav` each used to call a hook
 * that kept its own local `useState`, hydrated only on that instance's own
 * mount. Clicking a mode in the switcher wrote localStorage and updated the
 * switcher's own copy; `MainLayout`'s copy — mounted in a layout.tsx that
 * survives an in-segment navigation — never re-read it, so the sidebar kept
 * showing whatever mode it resolved to at its last mount. Lifting the state
 * here means every reader re-renders from the same `setMode` call, in the
 * same tick, regardless of which layout mounted it.
 */
export function AccessModeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  // Starts `null` on every render, same as the hook this replaces: server and
  // first client render agree, so there is nothing to hydrate-mismatch on.
  const [stored, setStored] = useState<AccessMode | null>(null);

  useEffect(() => {
    setStored(getStoredAccessMode());
  }, []);

  const qualifiedModes = qualifiedAccessModes(roles);
  const mode = resolveAccessMode(roles, stored);

  const setMode = useCallback((next: AccessMode) => {
    setStoredAccessMode(next);
    setStored(next);
  }, []);

  return (
    <AccessModeContext.Provider value={{ mode, qualifiedModes, setMode }}>
      {children}
    </AccessModeContext.Provider>
  );
}

export function useAccessMode() {
  const context = useContext(AccessModeContext);
  if (context === undefined) {
    throw new Error("useAccessMode must be used within AccessModeProvider");
  }
  return context;
}
