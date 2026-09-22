"use client";

import React, { useEffect, useRef } from "react";
// @ts-ignore
import type { PWAInstallElement } from "@khmyznikov/pwa-install";

// The <pwa-install> JSX typing ships with @khmyznikov/pwa-install; declaring
// a second one here collides with it.

export function PWAInstall() {
  const pwaInstallRef = useRef<PWAInstallElement | null>(null);

  useEffect(() => {
    // Already code-split via the dynamic import, but this mounts in the root
    // layout, so every page — including a signup form or a Stripe payment
    // step — was firing it the instant hydration finished, competing with
    // whatever that page actually needed. The install prompt has nothing to
    // offer for several seconds regardless, so idle time is soon enough.
    const load = () => {
      import("@khmyznikov/pwa-install");
    };
    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(load, { timeout: 3000 });
      return () => cancelIdleCallback(id);
    }
    const id = setTimeout(load, 1500);
    return () => clearTimeout(id);
  }, []);

  return (
    <pwa-install
      ref={pwaInstallRef}
      manifest-url="/manifest.webmanifest"
      name="Expeditoo"
      description="Install Expeditoo for a better experience: real-time updates, offline access, and faster loading."
      icon="/icons/icon-192x192.png"
      manual-apple="true"
    ></pwa-install>
  );
}
