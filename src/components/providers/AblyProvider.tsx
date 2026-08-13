"use client";

import * as Ably from "ably";
import { AblyProvider as AblyReactProvider } from "ably/react";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";

import { AblySubscriptions } from "./AblySubscriptions";

/**
 * Context to store the Ably client directly
 * This allows components to access the client without using ably/react hooks
 */
const AblyClientContext = createContext<Ably.Realtime | null>(null);

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

/**
 * AblyProvider wraps the application with Ably real-time context
 * Only creates connection when user is authenticated
 *
 * Uses authCallback to handle our standard API response format:
 * { success: true, data: TokenRequest }
 *
 * @see docs/plans/plan_ably_integration.md
 */
export function AblyProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const [client, setClient] = useState<Ably.Realtime | null>(null);
  // Track user ID to detect user changes
  const userIdRef = useRef<string | null>(null);
  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    // Don't do anything while loading
    if (isLoading) {
      return;
    }

    const currentUserId = user?.id || null;

    // Check if user changed (including logout)
    if (userIdRef.current !== currentUserId) {
      // Close existing client if there is one
      if (client) {
        // Store reference before nullifying
        const oldClient = client;

        // Update state first
        if (isMountedRef.current) {
          setClient(null);
        }
        userIdRef.current = null;

        // Then close the old client asynchronously
        // Use requestIdleCallback or setTimeout to defer
        if (typeof requestIdleCallback !== "undefined") {
          requestIdleCallback(() => {
            try {
              if (oldClient.connection.state !== "closed" &&
                oldClient.connection.state !== "closing" &&
                oldClient.connection.state !== "failed") {
                oldClient.close();
              }
            } catch (e) {
              // Expected during rapid cleanup - only log in dev for debugging
              if (process.env.NODE_ENV === "development") {
                console.debug("[Ably] Cleanup close (requestIdleCallback):", e);
              }
            }
          });
        } else {
          setTimeout(() => {
            try {
              if (oldClient.connection.state !== "closed" &&
                oldClient.connection.state !== "closing" &&
                oldClient.connection.state !== "failed") {
                oldClient.close();
              }
            } catch (e) {
              // Expected during rapid cleanup - only log in dev for debugging
              if (process.env.NODE_ENV === "development") {
                console.debug("[Ably] Cleanup close (setTimeout):", e);
              }
            }
          }, 100);
        }
      }
    }

    // No user = no client needed
    if (!user) {
      userIdRef.current = null;
      return;
    }

    // Already have a client for this user
    if (client && userIdRef.current === user.id) {
      return;
    }

    // Check if realtime is enabled (feature flag for rollback)
    const isRealtimeEnabled = process.env.NEXT_PUBLIC_REALTIME_ENABLED !== "false";
    if (!isRealtimeEnabled) {
      console.log("[Ably] Real-time disabled via feature flag");
      return;
    }

    // Create new Ably client with custom auth callback
    const ablyClient = new Ably.Realtime({
      authCallback: async (_tokenParams, callback) => {
        try {
          const response = await fetch("/api/ably/auth");
          const result = await response.json();

          if (!result.success) {
            console.error("[Ably] Auth failed:", result.error?.message);
            callback(result.error?.message || "Auth failed", null);
            return;
          }

          callback(null, result.data);
        } catch (error) {
          console.error("[Ably] Auth error:", error);
          callback(error instanceof Error ? error.message : "Auth error", null);
        }
      },
      // Auto-reconnect on disconnect
      disconnectedRetryTimeout: 5000,
      suspendedRetryTimeout: 15000,
      // Handle browser unload gracefully
      closeOnUnload: true,
      // Don't auto-connect, we'll connect manually after setting up listeners
      autoConnect: false,
    });

    // Log connection state changes (dev only)
    if (process.env.NODE_ENV === "development") {
      ablyClient.connection.on("connected", () => {
        console.log("[Ably] Connected");
      });
      ablyClient.connection.on("disconnected", () => {
        console.log("[Ably] Disconnected");
      });
      ablyClient.connection.on("failed", () => {
        console.error("[Ably] Connection failed");
      });
      ablyClient.connection.on("closed", () => {
        console.log("[Ably] Connection closed");
      });
    }

    // Now connect
    ablyClient.connect();

    userIdRef.current = user.id;
    if (isMountedRef.current) {
      setClient(ablyClient);
    }

    // Cleanup on unmount only - NOT on dependency changes
    // We handle user changes in the effect body above
  }, [user, isLoading, client]);

  // Cleanup on unmount
  useEffect(() => {
    // Store reference to prevent stale closure issues
    const clientRef = client;

    return () => {
      // On unmount, close any existing client
      if (clientRef) {
        // Use setTimeout to defer cleanup and avoid race conditions
        setTimeout(() => {
          try {
            // Extra defensive check - ensure connection object and state exist
            const connectionState = clientRef.connection?.state;
            if (connectionState &&
              connectionState !== "closed" &&
              connectionState !== "closing" &&
              connectionState !== "failed") {
              clientRef.close();
            }
          } catch {
            // Expected during unmount cleanup - "Connection closed" errors are normal
            // Silently ignore as this is expected behavior during React cleanup
          }
        }, 0);
      }
    };
  }, [client]);

  // If no client (not logged in or loading), just render children with null client
  if (!client) {
    return (
      <AblyClientContext.Provider value={null}>
        {children}
      </AblyClientContext.Provider>
    );
  }

  // Wrap with both our context and the Ably provider
  return (
    <AblyClientContext.Provider value={client}>
      <AblyReactProvider client={client}>
        <AblySubscriptions />
        {children}
      </AblyReactProvider>
    </AblyClientContext.Provider>
  );
}
