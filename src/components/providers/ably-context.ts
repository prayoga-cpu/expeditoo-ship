"use client";

import { createContext, useContext } from "react";
import type * as Ably from "ably";

/**
 * The Ably client, for components that want it directly. Its own light module
 * so the provider that owns the slot (`LazyAblyProvider`) can sit around the
 * whole app without pulling the SDK into the first bundle.
 *
 * `null` while signed out, while the SDK loads, and on the server.
 */
export const AblyClientContext = createContext<Ably.Realtime | null>(null);

/**
 * Get the Ably client from context
 * Returns null if not inside AblyProvider or not authenticated
 */
export function useAblyClientContext(): Ably.Realtime | null {
  return useContext(AblyClientContext);
}

/**
 * Check if Ably is available (user is logged in and client exists)
 */
export function useAblyAvailable(): boolean {
  const client = useAblyClientContext();
  return client !== null;
}
