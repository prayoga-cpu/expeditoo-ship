"use client";

import dynamic from "next/dynamic";
import React, { useState } from "react";
import type * as Ably from "ably";

import { AblyClientContext } from "./ably-context";

const AblyConnection = dynamic(
  () => import("./AblyProvider").then((mod) => mod.AblyConnection),
  {
    ssr: false,
    loading: () => null // Render nothing while loading
  }
);

/**
 * The realtime slot, without ever wrapping the app in something that changes
 * (2.96.0 #36).
 *
 * This used to be `dynamic(AblyProvider, { ssr: false })` *around* `children`,
 * which did two things to every page: the server bailed out of rendering the
 * whole app (an `ssr: false` component renders nothing there, so neither did
 * anything inside it), and once the Ably client connected the provider swapped
 * `children` into a new parent — React remounted the entire tree a beat after
 * sign-in resolved, and a tap on the navigation in that beat was lost.
 *
 * The client now lives in state here, `children` keep one fixed place, and
 * the connection — the SDK, the subscriptions — is a lazily loaded sibling
 * that only writes into that state.
 */
export function LazyAblyProvider({ children }: { children: React.ReactNode }) {
  const [client, setClient] = useState<Ably.Realtime | null>(null);

  return (
    <AblyClientContext.Provider value={client}>
      <AblyConnection client={client} setClient={setClient} />
      {children}
    </AblyClientContext.Provider>
  );
}
