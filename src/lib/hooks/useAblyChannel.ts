"use client";

import { useChannel, useConnectionStateListener } from "ably/react";
import { useCallback, useState } from "react";
import type { Message } from "ably";
import { z } from "zod";

/**
 * Custom hook wrapper for Ably channel subscriptions with Zod validation
 * Provides type-safe event handling and automatic validation
 * 
 * IMPORTANT: This hook can ONLY be used inside AblyReactProvider.
 * Use useAblyAvailable() to check availability before calling this hook.
 *
 * @see docs/plans/plan_ably_integration.md
 */
export function useAblyChannel<T>(
  channelName: string,
  eventName: string,
  schema: z.ZodSchema<T>,
  onMessage: (data: T) => void,
  enabled: boolean = true
) {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Track connection state
  useConnectionStateListener((state) => {
    setIsConnected(state.current === "connected");
  });

  // Message handler with Zod validation
  const handleMessage = useCallback(
    (message: Message) => {
      if (message.data === undefined) return;
      
      const parsed = schema.safeParse(message.data);

      if (!parsed.success) {
        console.error(
          `[Ably] Invalid ${eventName} payload on ${channelName}:`,
          parsed.error.flatten()
        );
        setError(new Error("Invalid event payload"));
        return; // Fail-safe: ignore invalid events
      }

      onMessage(parsed.data);
    },
    [channelName, eventName, schema, onMessage]
  );

  // Subscribe to channel
  const { channel } = useChannel(
    enabled ? channelName : { channelName, skip: true },
    eventName,
    handleMessage
  );

  return {
    channel,
    isConnected,
    error,
  };
}

/**
 * Hook to check if Ably connection is active
 * Useful for showing connection status indicators
 * 
 * IMPORTANT: Can ONLY be used inside AblyReactProvider
 */
export function useAblyConnectionState() {
  const [state, setState] = useState<string>("initialized");

  useConnectionStateListener((stateChange) => {
    setState(stateChange.current);
  });

  return {
    state,
    isConnected: state === "connected",
    isConnecting: state === "connecting",
    isDisconnected: state === "disconnected" || state === "suspended",
    isFailed: state === "failed",
  };
}
