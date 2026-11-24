"use client";

import * as Ably from "ably";
import { AblyProvider as AblyReactProvider } from "ably/react";
import { useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth-context";

import { AblySubscriptions } from "./AblySubscriptions";

// The context lives in a light module so the slot around the app does not
// load the SDK; re-exported here for the existing imports.
export { useAblyAvailable, useAblyClientContext } from "./ably-context";

interface AblyConnectionProps {
  /** The slot `LazyAblyProvider` owns and publishes to the app. */
  client: Ably.Realtime | null;
  setClient: (client: Ably.Realtime | null) => void;
}

/**
 * Opens and closes the Ably connection for the signed-in user, and runs the
 * app-wide subscriptions. Only creates a connection when the user is
 * authenticated.
 *
 * It is a sibling of the app, never its parent (2.96.0 #36): the client it
 * creates goes into `LazyAblyProvider`'s state, which the app reads through
 * `useAblyClientContext`. `AblyReactProvider` wraps only the subscriptions, so
 * connecting no longer re-parents — and remounts — every page. A hook from
 * `ably/react` (`useAblyChannel`) therefore belongs under this component, not
 * in a page.
 *
 * Uses authCallback to handle our standard API response format:
 * { success: true, data: TokenRequest }
 *
 * @see docs/plans/plan_ably_integration.md
 */
export function AblyConnection({ client, setClient }: AblyConnectionProps) {
  const { user, isLoading } = useAuth();
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
  }, [user, isLoading, client, setClient]);

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

  if (!client) return null;

  return (
    <AblyReactProvider client={client}>
      <AblySubscriptions />
    </AblyReactProvider>
  );
}
