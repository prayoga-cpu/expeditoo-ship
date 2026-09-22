"use client";

import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/lib/auth-context";
import {
  type AccessMode,
  getStoredAccessMode,
  qualifiedAccessModes,
  resolveAccessMode,
  setStoredAccessMode,
} from "@/lib/active-access";

/**
 * Which access the signed-in account is currently browsing with, and what
 * else it could switch to.
 *
 * `stored` starts `null` on every render — server and first client render
 * agree, so there is nothing to hydrate-mismatch on — and is filled in from
 * localStorage right after mount, same as ThemeToggle's `mounted` gate. A
 * multi-role account can see its nav list settle a frame after paint; it
 * never flashes the wrong *session*, only briefly the wrong *preference*.
 */
export function useActiveAccessMode() {
  const { user } = useAuth();
  const roles = user?.roles ?? [];
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

  return { mode, qualifiedModes, setMode };
}
