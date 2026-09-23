"use client";

import { useAccessMode } from "@/lib/access-mode-context";

/**
 * Which access the signed-in account is currently browsing with, and what
 * else it could switch to.
 *
 * A thin re-export of `useAccessMode` (`access-mode-context.tsx`), kept under
 * this name and shape so every existing call site — `AccessSwitcher`,
 * `MainLayout`, `BottomNav` — needed no change when the state it reads moved
 * from a per-instance `useState` to one shared provider.
 */
export const useActiveAccessMode = useAccessMode;
